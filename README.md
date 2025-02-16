# Payment Processing Simulator

A robust payment transaction simulator designed to test and demonstrate payment processing workflows, built with React, TypeScript, and Supabase. This application simulates real-world payment processing scenarios, including transaction processing, load testing, and ISO8583-like message generation.

## Features

### Transaction Processing
- Support for multiple transaction types:
  - Purchases
  - Refunds
  - Reversals
- Real-time transaction status updates
- ISO8583-like message generation
- Secure card number handling with masking
- Merchant ID tracking

### Load Testing
- Configurable transactions per second (TPS)
- Adjustable test duration
- Customizable transaction amounts
- Real-time performance metrics
- Batch simulation tracking

### Analytics
- Transaction success rate monitoring
- Actual TPS calculations
- Total amount tracking
- Detailed transaction logs

## Technology Stack

- **Frontend**: React with TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Database**: Supabase
- **Build Tool**: Vite

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Connect to Supabase:
   - Click the "Connect to Supabase" button in the top right
   - Wait for the connection process to complete

4. Start the development server:
   ```bash
   npm run dev
   ```

## Database Schema

### Tables
- `transactions`: Stores individual transaction records
- `simulation_batches`: Tracks load test simulation runs

### Security
- Row Level Security (RLS) enabled
- Policies for authenticated users
- Secure data access controls

## Known Issues and Resolutions

### Resolved Issues

1. **RLS Policy Violations**
   - Issue: Initial transactions failed due to RLS policy restrictions
   - Resolution: Implemented proper RLS policies for authenticated users

2. **Supabase Client Export**
   - Issue: Supabase client export was missing
   - Resolution: Fixed the supabaseClient.ts file to properly export the client

### Current Limitations

1. **Transaction Simulation**
   - Currently simulates basic approval/decline scenarios
   - Future enhancement: Add more complex validation rules

2. **Load Testing**
   - Limited to single-instance testing
   - Future enhancement: Distributed load testing support

## Future Plans

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

## Contributing

Contributions are welcome! Please feel free to submit pull requests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with [Supabase](https://supabase.com) for real-time database capabilities
- UI components powered by [Tailwind CSS](https://tailwindcss.com)
- Icons provided by [Lucide](https://lucide.dev)











# Infrastructure and Deployment Guide

## Infrastructure Components

### Production Environment

1. **Frontend Hosting (Netlify)**
   ```bash
   # Build configuration
   Build command: npm run build
   Publish directory: dist
   Node version: 18.x
   ```

2. **Database (Supabase)**
   - Production project setup
   - Database configuration
   - Backup policies
   - Monitoring

3. **Environment Variables**
   ```plaintext
   VITE_SUPABASE_URL=your-production-supabase-url
   VITE_SUPABASE_ANON_KEY=your-production-anon-key
   ```

## Deployment Steps

1. **Initial Setup**
   ```bash
   # Install dependencies
   npm install

   # Build the application
   npm run build

   # Run tests
   npm run test
   ```

2. **Database Setup**
   - Create production Supabase project
   - Run migrations
   - Configure RLS policies
   - Set up backup schedule

3. **Frontend Deployment**
   ```bash
   # Deploy to Netlify
   netlify deploy --prod
   ```

## Scaling Considerations

1. **Database Scaling**
   - Enable connection pooling
   - Configure read replicas for high load
   - Set up proper indexing

2. **Frontend Performance**
   - Enable CDN caching
   - Implement rate limiting
   - Configure proper cache headers

## Monitoring Setup

1. **Database Monitoring**
   - Enable Supabase monitoring
   - Set up alerts for:
     - High CPU usage
     - Connection limits
     - Storage usage

2. **Frontend Monitoring**
   - Enable Netlify analytics
   - Set up error tracking
   - Monitor performance metrics

## Backup Strategy

1. **Database Backups**
   - Daily automated backups
   - Point-in-time recovery
   - Backup retention policy

2. **Configuration Backups**
   - Environment variables
   - Deployment configurations
   - Infrastructure as Code files

## Security Measures

1. **Frontend Security**
   - Enable HTTPS
   - Configure CSP headers
   - Enable rate limiting

2. **Database Security**
   - RLS policies
   - API key rotation
   - Regular security audits

## CI/CD Pipeline

1. **GitHub Actions Workflow**
   ```yaml
   name: CI/CD Pipeline
   
   on:
     push:
       branches: [main]
     pull_request:
       branches: [main]
   
   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v2
         - uses: actions/setup-node@v2
           with:
             node-version: '18'
         - run: npm ci
         - run: npm run build
         - run: npm test
   
     deploy:
       needs: build
       runs-on: ubuntu-latest
       if: github.ref == 'refs/heads/main'
       steps:
         - uses: actions/checkout@v2
         - uses: netlify/actions/cli@master
           with:
             args: deploy --prod
           env:
             NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
             NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
   ```

## Disaster Recovery

1. **Recovery Procedures**
   - Database restore process
   - Frontend rollback steps
   - Configuration recovery

2. **Incident Response**
   - Communication plan
   - Recovery time objectives
   - Recovery point objectives

## Performance Optimization

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

## Cost Optimization

1. **Resource Management**
   - Scale-to-zero when possible
   - Optimize database connections
   - Monitor usage patterns

2. **Infrastructure Costs**
   - Regular cost reviews
   - Resource utilization monitoring
   - Optimization recommendations

## Maintenance Procedures

1. **Regular Updates**
   - Dependency updates
   - Security patches
   - Performance improvements

2. **Health Checks**
   - Database maintenance
   - Frontend monitoring
   - Security audits








   # DevOps Implementation Guide

## 1. Version Control (Git)

```bash
# Initialize Git repository
git init

# Create .gitignore
echo "node_modules/
dist/
.env
*.log" > .gitignore

# Initial commit
git add .
git commit -m "Initial commit"
```

## 2. Continuous Integration (GitHub Actions)

Create `.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
```

## 3. Continuous Deployment (Netlify)

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Initialize Netlify project
netlify init

# Create netlify.toml
cat > netlify.toml << EOL
[build]
  command = "npm run build"
  publish = "dist"

[context.production]
  environment = { NODE_VERSION = "18" }

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
EOL
```

## 4. Container Management (Docker)

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "80:80"
    environment:
      - VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
      - VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
```

## 5. Infrastructure as Code (Terraform)

Create `main.tf`:
```hcl
terraform {
  required_providers {
    netlify = {
      source = "netlify/netlify"
    }
  }
}

resource "netlify_site" "payment_simulator" {
  name = "payment-simulator"
  
  repo {
    provider = "github"
    repo_path = "username/payment-simulator"
    branch = "main"
  }
}

resource "netlify_deploy_key" "key" {
  site_id = netlify_site.payment_simulator.id
}
```

## 6. Monitoring (Datadog)

Create `datadog-config.yml`:
```yaml
logs:
  - type: file
    path: /var/log/app.log
    service: payment-simulator
    source: nodejs

apm_config:
  enabled: true

process_config:
  enabled: true
```

## 7. Load Testing (k6)

Create `load-test.js`:
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 20 },
    { duration: '30s', target: 0 },
  ],
};

export default function () {
  const payload = JSON.stringify({
    type: 'PURCHASE',
    amount: 100,
    cardNumber: '4111111111111111',
    merchantId: 'TEST_MERCHANT',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post('http://localhost:5173/api/transaction', payload, params);
  check(res, { 'status was 200': (r) => r.status === 200 });
  sleep(1);
}
```

## 8. Security Scanning

Create `.github/workflows/security.yml`:
```yaml
name: Security Scan

on:
  push:
    branches: [ main ]
  schedule:
    - cron: '0 0 * * 0'

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Snyk to check for vulnerabilities
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
          
      - name: Run OWASP ZAP scan
        uses: zaproxy/action-full-scan@v0.4.0
        with:
          target: 'https://your-deployed-app.netlify.app'
```

## 9. Backup Strategy

Create `backup-script.sh`:
```bash
#!/bin/bash

# Backup environment variables
cp .env .env.backup-$(date +%Y%m%d)

# Backup Supabase database
curl -X POST \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  "${SUPABASE_URL}/rest/v1/rpc/pg_dump" \
  > backup-$(date +%Y%m%d).sql

# Upload to backup storage
aws s3 cp \
  backup-$(date +%Y%m%d).sql \
  s3://your-backup-bucket/payment-simulator/
```

## 10. Metrics and Logging

Add to `vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
});
```

## Usage Instructions

1. **Setup Development Environment**
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm run test

# Build for production
npm run build
```

2. **Deploy to Production**
```bash
# Deploy to Netlify
netlify deploy --prod

# Run Docker container
docker-compose up -d

# Apply Terraform configuration
terraform init
terraform apply
```

3. **Monitoring and Maintenance**
```bash
# Run load tests
k6 run load-test.js

# Check security vulnerabilities
npm audit

# Create backup
./backup-script.sh
```

## Best Practices

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

5. **Documentation**
   - Keep documentation updated
   - Document all procedures
   - Maintain runbooks