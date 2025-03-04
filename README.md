# Payment Processing Simulator

A robust payment transaction simulator designed to test and demonstrate payment processing workflows, built with **React**, **TypeScript**, and **Supabase**. This application simulates real-world payment processing scenarios, including transaction processing, load testing, and ISO8583-like message generation. Perfect for testing the resilience of payment platforms and understanding payment workflows.

---

## 🚀 **Features**

### **Transaction Processing**
- Support for multiple transaction types:
  - Purchases
  - Refunds
  - Reversals
- Real-time transaction status updates
- ISO8583-like message generation
- Secure card number handling with masking
- Merchant ID tracking

### **Load Testing**
- Configurable transactions per second (TPS)
- Adjustable test duration
- Customizable transaction amounts
- Real-time performance metrics
- Batch simulation tracking

### **Analytics**
- Transaction success rate monitoring
- Actual TPS calculations
- Total amount tracking
- Detailed transaction logs

---

## 🛠️ **Technology Stack**

- **Frontend**: React with TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Database**: Supabase
- **Build Tool**: Vite
- **Backend**: FastAPI (Python)
- **Deployment**: Render
- **Containerization**: Docker

---

## 🚀 **Getting Started**

### **Prerequisites**
- Node.js (v18 or higher)
- Python (v3.9 or higher)
- Docker (optional)

### **Steps to Run Locally**
1. Clone the repository:
   ```bash
   git clone https://github.com/4Min4m/TransactionSimulator.git
   cd TransactionSimulator
   ```

2. Install dependencies:
   ```bash
   # Frontend
   cd frontend
   npm install

   # Backend
   cd ../backend
   pip install -r requirements.txt
   ```

3. Set up environment variables:
   - Create a `.env` file in the `backend` directory:
     ```plaintext
     SUPABASE_URL=your-supabase-url
     SUPABASE_KEY=your-supabase-key
     ```

4. Start the development servers:
   - **Frontend**:
     ```bash
     cd frontend
     npm run dev
     ```
   - **Backend**:
     ```bash
     cd backend
     uvicorn app.main:app --reload
     ```

5. Open your browser and navigate to `http://localhost:5173`.

---

## 🗄️ **Database Schema**

### **Tables**
- `transactions`: Stores individual transaction records
- `simulation_batches`: Tracks load test simulation runs

### **Security**
- Row Level Security (RLS) enabled
- Policies for authenticated users
- Secure data access controls

---

## 🐛 **Known Issues and Resolutions**

### **Resolved Issues**
1. **RLS Policy Violations**
   - Issue: Initial transactions failed due to RLS policy restrictions
   - Resolution: Implemented proper RLS policies for authenticated users

2. **Supabase Client Export**
   - Issue: Supabase client export was missing
   - Resolution: Fixed the `supabaseClient.ts` file to properly export the client

### **Current Limitations**
1. **Transaction Simulation**
   - Currently simulates basic approval/decline scenarios
   - Future enhancement: Add more complex validation rules

2. **Load Testing**
   - Limited to single-instance testing
   - Future enhancement: Distributed load testing support

---

## 🌟 **Future Plans**

1. **Enhanced Transaction Processing**
   - Add support for more transaction types
   - Implement advanced fraud detection simulation
   - Add support for different card types

2. **Advanced Load Testing**
   - Distributed load testing capabilities
   - Custom scenario creation
   - Advanced metrics and reporting

3. **Analytics Dashboard**
   - Real-time transaction monitoring
   - Advanced analytics and reporting
   - Custom metric tracking

4. **Security Enhancements**
   - Additional authentication methods
   - Enhanced encryption simulation
   - PCI compliance demonstration

5. **API Integration**
   - External payment gateway simulation
   - Webhook support
   - Third-party integration examples

---

## 🤝 **Contributing**

Contributions are welcome! Please feel free to submit pull requests or open issues for any bugs or feature requests.

1. Fork the repository.
2. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Commit your changes:
   ```bash
   git commit -m "Add your feature"
   ```
4. Push to the branch:
   ```bash
   git push origin feature/your-feature-name
   ```
5. Open a pull request.

---

## 📜 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 **Acknowledgments**

- Built with [Supabase](https://supabase.com) for real-time database capabilities
- UI components powered by [Tailwind CSS](https://tailwindcss.com)
- Icons provided by [Lucide](https://lucide.dev)
- Backend powered by [FastAPI](https://fastapi.tiangolo.com)

---

## 🔗 **Links**

- **Live Demo**: [Transaction Simulator](https://trasimu.onrender.com)
- **GitHub Repository**: [GitHub Repo](https://github.com/4Min4m/TransactionSimulator)

---

## 📊 **Infrastructure and Deployment**

### **Production Environment**
- **Frontend Hosting**: Render
- **Backend Hosting**: Render
- **Database**: Supabase

### **Environment Variables**
```plaintext
VITE_SUPABASE_URL=your-production-supabase-url
VITE_SUPABASE_ANON_KEY=your-production-anon-key
```

---

## 🛡️ **Security Measures**

1. **Frontend Security**
   - Enable HTTPS
   - Configure CSP headers
   - Enable rate limiting

2. **Database Security**
   - RLS policies
   - API key rotation
   - Regular security audits

---

## 📈 **Performance Optimization**

1. **Database Optimization**
   ```sql
   -- Example index creation for frequently accessed columns
   CREATE INDEX idx_transactions_timestamp ON transactions(timestamp);
   CREATE INDEX idx_simulation_batches_status ON simulation_batches(status);
   ```

2. **Frontend Optimization**
   - Code splitting
   - Asset optimization
   - Caching strategies

---

## 💡 **Best Practices**

1. **Version Control**
   - Use feature branches
   - Follow conventional commits
   - Require pull request reviews

2. **CI/CD**
   - Automate all deployments
   - Include automated tests
   - Implement staging environments

3. **Security**
   - Regular dependency updates
   - Security scanning in CI
   - Environment variable management

4. **Monitoring**
   - Set up alerts
   - Monitor error rates
   - Track performance metrics

---

## 📝 **Documentation**

- **API Documentation**: Available at `/docs` when running the backend locally.
- **User Guide**: Coming soon!
- **Developer Guide**: Check the [GitHub Wiki](https://github.com/4Min4m/TransactionSimulator/wiki).

---

## 🌐 **Community**

Join the discussion and share your feedback:
- **GitHub Issues**: [Open an Issue](https://github.com/4Min4m/TransactionSimulator/issues)
- **LinkedIn Post**: [Project Announcement](#)

---

**#PaymentSimulator #FastAPI #ReactJS #Supabase #Docker #Render #DevOps #OpenSource #FinTech #PaymentProcessing #LoadTesting #TransactionSimulation**
