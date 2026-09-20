const express = require('express');
const { Redis } = require('@upstash/redis');

const app = express();
app.use(express.json());

// Inisialisasi Database Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const SECRET_KEY = process.env.SECRET_KEY || "qo8nkQ_GtaaBkZEt9i4QphNHFvIwNLAf";

// ============================================================
// 1. WEBHOOK RECEIVER (DARI SAWERIA)
// ============================================================
app.post('/api/webhook/saweria', async (req, res) => {
  try {
    const data = req.body;

    const donorName = data.donator_name || "Anonim";
    const amount = data.amount_raw || 0;
    const message = data.message || "";
    
    // Ambil kata pertama dalam pesan sebagai target username Roblox
    const matchedUsername = message.trim().split(" ")[0] || donorName;

    const donationObj = {
      id: data.id || `saweria_${Date.now()}`,
      donor: donorName,
      amount: amount,
      message: message,
      matchedUsername: matchedUsername,
      platform: "saweria",
      timestamp: Date.now()
    };

    await redis.lpush('donations_queue', JSON.stringify(donationObj));

    return res.status(200).json({ ok: true, message: "Donation received" });
  } catch (err) {
    console.error("Webhook Error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// 2. POLLING ENDPOINT (DIPANGGIL ROBLOX)
// ============================================================
app.get('/api/donations/:secretKey', async (req, res) => {
  const userSecret = req.params.secretKey;

  if (userSecret !== SECRET_KEY) {
    return res.status(403).json({ ok: false, error: "Unauthorized / Invalid Secret Key" });
  }

  try {
    const rawDonations = await redis.lrange('donations_queue', 0, -1);
    
    const donations = rawDonations.map(item => {
      return typeof item === 'string' ? JSON.parse(item) : item;
    });

    if (donations.length > 0) {
      await redis.del('donations_queue');
    }

    return res.status(200).json({
      ok: true,
      donations: donations
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = app;
