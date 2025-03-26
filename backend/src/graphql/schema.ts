import { gql } from "@apollo/server";
import { getTransactions } from "../services/supabaseService";

// schema
export const typeDefs = gql`
  type Transaction {
    id: ID!
    card_number: String!
    amount: Float!
    merchant_id: String!
    status: String!
    type: String!
    timestamp: String!
    created_at: String!
    updated_at: String!
    iso8583_message: JSON
  }

  type Query {
    transactions: [Transaction!]!
  }
`;

//  Resolvers
export const resolvers = {
  Query: {
    transactions: async () => {
      const transactions = await getTransactions();
      return transactions;
    },
  },
};