import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import Stripe from "stripe";
import admin from "firebase-admin";

import { getFirestore } from "firebase-admin/firestore";

// Load Firebase Config
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}
const db = getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId);

// Initialize Global Stats
async function initStats(retries = 5) {
  try {
    const statsRef = db.collection("stats").doc("global");
    const statsDoc = await statsRef.get();
    if (!statsDoc.exists) {
      await statsRef.set({ 
        founder_monthly_count: 0,
        founder_yearly_count: 0 
      });
    } else {
      // Migration: if old field exists, ensure new ones do too
      const data = statsDoc.data();
      if (data && data.founder_count !== undefined && (data.founder_monthly_count === undefined || data.founder_yearly_count === undefined)) {
        await statsRef.update({
          founder_monthly_count: data.founder_monthly_count || 0,
          founder_yearly_count: data.founder_yearly_count || 0
        });
      }
    }
  } catch (error: any) {
    if (retries > 0 && (error.code === 5 || error.message.includes('NOT_FOUND'))) {
      console.log(`Retrying initStats... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return initStats(retries - 1);
    }
    console.error("Failed to initialize stats:", error);
  }
}
initStats().catch(console.error);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16" as any,
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API: Stripe Webhook (MUST be before express.json())
  app.post("/api/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || "");
    } catch (err: any) {
      console.error("Webhook Signature Error:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "invoice.paid") {
      const session = event.data.object as any;
      const customerId = session.customer;
      
      // Find user by stripe_customer_id
      const usersSnapshot = await db.collection("users").where("stripe_customer_id", "==", customerId).get();
      
      if (!usersSnapshot.empty) {
        const userDoc = usersSnapshot.docs[0];
        await userDoc.ref.update({
          generations_used: 0, // Reset on payment
          subscription_status: "active"
        });
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as any;
      const customerId = invoice.customer;
      
      const usersSnapshot = await db.collection("users").where("stripe_customer_id", "==", customerId).get();
      if (!usersSnapshot.empty) {
        const userDoc = usersSnapshot.docs[0];
        await userDoc.ref.update({
          subscription_status: "past_due"
        });
      }
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const userId = session.metadata.userId;
      const planType = session.metadata.planType;

      if (userId && planType) {
        const userRef = db.collection("users").doc(userId);
        const limit = planType === 'founder_monthly' ? 50 : 600;

        await userRef.update({
          plan: planType,
          generation_limit: limit,
          subscription_status: "active",
          last_reset: new Date().toISOString()
        });

        // Increment founder count based on plan
        const statsRef = db.collection("stats").doc("global");
        const counterField = planType === 'founder_monthly' ? 'founder_monthly_count' : 'founder_yearly_count';
        await statsRef.update({
          [counterField]: admin.firestore.FieldValue.increment(1)
        });
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as any;
      const customerId = subscription.customer;

      const usersSnapshot = await db.collection("users").where("stripe_customer_id", "==", customerId).get();
      if (!usersSnapshot.empty) {
        const userDoc = usersSnapshot.docs[0];
        await userDoc.ref.update({
          plan: "free",
          generation_limit: 20,
          subscription_status: "canceled"
        });
      }
    }

    res.json({ received: true });
  });

  app.use(express.json());

  // API: Create Checkout Session
  app.post("/api/create-checkout-session", async (req, res) => {
    const { userId, planType } = req.body;

    try {
      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        return res.status(404).json({ error: "User not found" });
      }

      const userData = userDoc.data();
      let customerId = userData?.stripe_customer_id;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: userData?.email,
          metadata: { userId },
        });
        customerId = customer.id;
        await userRef.update({ stripe_customer_id: customerId });
      }

      // Define Price IDs (These should be in environment variables)
      const priceIds: Record<string, string> = {
        founder_monthly: process.env.STRIPE_PRICE_FOUNDER_MONTHLY || "price_placeholder_monthly",
        founder_yearly: process.env.STRIPE_PRICE_FOUNDER_YEARLY || "price_placeholder_yearly",
      };

      const priceId = priceIds[planType];
      if (!priceId) {
        return res.status(400).json({ error: "Invalid plan type" });
      }

      // Check founder limit
      if (planType.startsWith('founder')) {
        const statsRef = db.collection("stats").doc("global");
        const statsDoc = await statsRef.get();
        const data = statsDoc.data();
        const counterField = planType === 'founder_monthly' ? 'founder_monthly_count' : 'founder_yearly_count';
        const count = data?.[counterField] || 0;
        
        if (count >= 500) {
          return res.status(400).json({ error: `${planType.replace('_', ' ')} spots are sold out.` });
        }
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        success_url: `${process.env.APP_URL}/?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.APP_URL}/`,
        metadata: { userId, planType },
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
