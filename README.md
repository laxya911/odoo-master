# 🏔️ Himalayan Heritage | Odoo-Powered Restaurant Platform

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![Odoo](https://img.shields.io/badge/Odoo-19%20Community-purple?logo=odoo)](https://www.odoo.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-blue?logo=tailwind-css)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)

A premium, high-performance web platform for modern restaurants, seamlessly integrated with **Odoo POS**. Built for speed, elegance, and reliability.

---

## ✨ Core Features

### 🍽️ Dynamic Menu & Configurator
- **Odoo Sync**: Real-time product synchronization from Odoo categories and attributes.
- **Smart Configurator**: Multi-step configuration for combos, sides, and extras with dynamic price updates.
- **Visual Excellence**: High-definition imagery with fallback support and smooth micro-animations.

### 💳 Modern Checkout Experience
- **Multi-Step Checkout**: Frictionless modal-based flow (Personal Details → Delivery → Payment).
- **Payment Diversification**: Integrated with **Stripe** and **Razorpay** hosted checkout for secure and CSP-safe transactions.
- **Real-time Tracking**: Post-order polling and live status updates (Received → Preparing → Delivered).

### 🌍 Global Reach
- **Dual Language**: Full support for **English (EN)** and **Japanese (JA)** with dynamic content translation.
- **Multi-Currency**: Automatic currency handling based on Odoo company configuration.

### 🛠️ Odoo Backend Integration
- **Direct POS Injection**: Orders are pushed directly into Odoo POS sessions using a custom Python API.
- **Metadata Synchronization**: Captures critical delivery info (API Source, Customer Details, Delivery Notes) for admin visibility.
- **Automated Invoicing**: Generates Odoo invoices with linked "Preferred Payment Methods".
### 📅 Booking & Reservations
- **Direct Odoo Integration**: Seamless table booking synced with Odoo's Calendar and Resource modules.
---

## 🚀 Tech Stack

- **Frontend**: Next.js 15 (App Router), Tailwind CSS, Framer Motion, Lucide React.
- **State Management**: React Context API & Zod (Validation).
- **Backend API**: Next.js Route Handlers (Edge-ready).
- **Database/ERP**: Odoo 19 (Community Edition) with Custom Python Addons.
- **Payments**: Stripe Checkout & Razorpay Hosted.

---

## 🔮 Future Roadmap

- **Status Tracking**: Real-time availability checks and automated confirmation emails.

### 🤝 Advanced CRM & CRM Integration
- **Odoo Contact Sync**: Unified customer database across website, POS, and CRM.
- **Loyalty Programs**: Earn and redeem points via Odoo's native loyalty system.
- **Personalized Offers**: Targeted promotions based on purchase history.

### 📊 Analytics Dashboard
- **Performance Insights**: Sales tracking and popular dish analytics directly from Odoo reporting.

---

## 🛠️ Getting Started

1. **Clone the repository**
2. **Configure Environment Variables**:
   - `ODOO_BASE_URL`, `ODOO_DB`, `ODOO_API_KEY`
   - `STRIPE_SECRET_KEY`, `RAZORPAY_KEY_SECRET`
3. **Install Dependencies**: `npm install`
4. **Run Development Server**: `npm run dev`

---

Developed with ❤️ for the Himalayan Heritage culinary experience.
