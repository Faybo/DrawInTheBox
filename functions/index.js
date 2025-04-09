require('dotenv').config();
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors')({ origin: true });

admin.initializeApp();

// Create a payment intent for Stripe
exports.createPaymentIntent = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to make a payment');
  }

  const { amount } = data;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'eur',
      metadata: { userId: context.auth.uid }
    });

    return { clientSecret: paymentIntent.client_secret };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw new functions.https.HttpsError('internal', 'Unable to create payment intent');
  }
});

// HTTP version of createPaymentIntent with CORS support
exports.createPaymentIntentHttp = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
      const { amount } = req.body;

      if (!amount) {
        return res.status(400).json({ error: 'Amount is required' });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'eur'
      });

      return res.status(200).json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
      console.error('Error creating payment intent:', error);
      return res.status(500).json({ error: 'Unable to create payment intent' });
    }
  });
});
