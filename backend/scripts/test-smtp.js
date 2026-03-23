#!/usr/bin/env node
/**
 * Verify Gmail (or any) SMTP from your machine or Render shell before deploying.
 * Usage: cd backend && node scripts/test-smtp.js
 * Loads .env from backend/ (same as server).
 */
require('dotenv').config();

const dns = require('dns');
const net = require('net');
const nodemailer = require('nodemailer');

async function resolveSmtpIPv4(hostname) {
    try {
        const addrs = await dns.promises.resolve4(hostname);
        if (addrs && addrs.length) return addrs[0];
    } catch (_) {}
    try {
        const r = await dns.promises.lookup(hostname, { family: 4 });
        return typeof r === 'string' ? r : r.address;
    } catch (_) {
        return null;
    }
}

async function main() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);

    if (!host || !user || !pass) {
        console.error('Missing SMTP_HOST, SMTP_USER, or SMTP_PASS in environment.');
        process.exit(1);
    }

    let connectHost = host;
    const tlsServername = host;
    if (!net.isIP(host)) {
        const ipv4 = await resolveSmtpIPv4(host);
        if (ipv4) {
            console.log(`Resolved ${host} → IPv4 ${ipv4} (will use this for TCP; TLS servername=${host})`);
            connectHost = ipv4;
        } else {
            console.warn('No IPv4 found; nodemailer may use IPv6 (can fail on Render).');
        }
    }

    const transport = nodemailer.createTransport({
        host: connectHost,
        port,
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user, pass },
        connectionTimeout: 45000,
        greetingTimeout: 30000,
        tls: { servername: tlsServername },
    });

    console.log('Verifying SMTP connection...');
    await transport.verify();
    console.log('OK — SMTP accepts credentials. You can deploy.');
    process.exit(0);
}

main().catch((err) => {
    console.error('SMTP verify failed:', err.message || err);
    process.exit(1);
});
