<<<<<<< HEAD
# datafast - Premium Data Purchase Platform
=======
# Inventor - Premium Data Purchase Platform
>>>>>>> 17c2f7527330ff389c604082625f8e28e0106a9a

A comprehensive data purchase platform built with Next.js 14, TypeScript, and Vercel BaaS. Features separate portals for customers, agents, wholesalers, and administrators with premium UI design.

## Features

### 🎯 Core Features
- **Multi-Role System**: Separate dashboards for Customers, Agents, Wholesalers/Dealers, and Admins
- **Data Purchase**: Buy data bundles for all Ghanaian networks (MTN, Vodafone, AirtelTigo)
- **Payment Integration**: Secure payments with Paystack
- **Real-time Updates**: Instant data activation after payment
- **Responsive Design**: Mobile-first, premium UI design

### 👥 User Roles

#### Customer Portal
- Browse and purchase data bundles
- Track order history
- View transaction records
- Manage account settings

#### Agent Portal
- Manage customer base
- Purchase data for customers
- Track commissions
- View sales analytics

#### Wholesaler/Dealer Portal
- Manage agent network
- Bulk data operations
- Advanced analytics
- Commission tracking

#### Admin Portal
- User management
- Data plan management
- Order monitoring
- Platform analytics

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **Payments**: Paystack
- **Deployment**: Vercel
- **UI Components**: Radix UI, Lucide React
- **Currency**: Ghana Cedi (GHS)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- PostgreSQL database
- Paystack account

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd datafast
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env.local` file in the root directory:
   ```env
   # Database
   POSTGRES_URL="your-postgres-connection-string"
   POSTGRES_PRISMA_URL="your-postgres-connection-string"
   POSTGRES_URL_NON_POOLING="your-postgres-connection-string"
   POSTGRES_USER="your-postgres-user"
   POSTGRES_HOST="your-postgres-host"
   POSTGRES_PASSWORD="your-postgres-password"
   POSTGRES_DATABASE="your-postgres-database"

   # NextAuth
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-nextauth-secret"

   # Paystack
   PAYSTACK_PUBLIC_KEY="your-paystack-public-key"
   PAYSTACK_SECRET_KEY="your-paystack-secret-key"

   # VTU Provider (DataHubGH) - Environment variables take precedence over database
   DATAHUBGH_API_KEY="your-datahubgh-api-key"
   DATAHUBGH_BASE_URL="https://user.datahubgh.com/api"  # Optional, defaults to this
   USE_ENV_FOR_VTU="true"  # Optional, set to "true" to force env vars (auto-enabled if DATAHUBGH_API_KEY is set)

   # SMS (Arkesel)
   ARKESEL_API_KEY="your-arkesel-api-key"
   ARKESEL_SENDER_ID="datafast"  # Optional, defaults to "datafast"

   # App
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   ```

4. **Database Setup**
   ```bash
   # Generate Prisma client
   npx prisma generate

   # Run database migrations
   npx prisma db push

   # Seed the database (optional)
   npx prisma db seed
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/                    # Next.js 14 app directory
│   ├── admin/             # Admin portal pages
│   ├── agent/             # Agent portal pages
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Customer portal pages
│   ├── payment/           # Payment callback pages
│   ├── wholesaler/        # Wholesaler portal pages
│   └── api/               # API routes
├── components/            # Reusable components
│   ├── layout/           # Layout components
│   └── ui/               # UI components
├── lib/                  # Utility functions
├── types/                # TypeScript type definitions
└── hooks/                # Custom React hooks
```

## Database Schema

The application uses the following main entities:

- **Users**: Customer, Agent, Wholesaler, Dealer, Admin
- **DataPlans**: Available data bundles
- **Orders**: Data purchase orders
- **Payments**: Payment transactions
- **DataUsage**: Data usage tracking
- **Transactions**: Financial transactions

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/signin` - User sign in

### Payments
- `POST /api/payment/initialize` - Initialize payment
- `POST /api/payment/verify` - Verify payment

### Data Plans
- `GET /api/data-plans` - Get available data plans
- `POST /api/data-plans` - Create new data plan (Admin)

## Deployment

### Vercel Deployment

1. **Connect to Vercel**
   - Push your code to GitHub
   - Connect your repository to Vercel

2. **Environment Variables**
   - Add all environment variables in Vercel dashboard

3. **Database**
   - Use Vercel Postgres or external PostgreSQL
   - Update connection strings

4. **Deploy**
   - Vercel will automatically deploy on push to main branch

### Manual Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Start production server**
   ```bash
   npm start
   ```

## Configuration

### Paystack Setup

1. Create a Paystack account
2. Get your public and secret keys
3. Add keys to environment variables
4. Configure webhook endpoints

### Database Configuration

1. Set up PostgreSQL database
   - For local development: Install PostgreSQL locally
   - For VPS hosting: See [VPS Database Setup Guide](./docs/VPS_DATABASE_SETUP.md) for detailed instructions
2. Update connection strings in `.env.local`
3. Run migrations: `npm run db:push` or `npm run db:migrate`
4. Seed initial data: `npm run db:seed`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Email: support@datafastgh.com
- Documentation: [docs.datafastgh.com](https://docs.datafastgh.com)



## Roadmap

- [ ] Mobile app (React Native)
- [ ] Advanced analytics dashboard
- [ ] SMS notifications
- [ ] API documentation
- [ ] Multi-language support
- [ ] Advanced reporting features
