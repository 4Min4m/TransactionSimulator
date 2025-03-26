import { gql } from "graphql-tag";
import { GraphQLJSON } from "graphql-type-json"; // You'll need to install this
import { getTransactions } from "../services/supabaseService";

// Define schema with JSON scalar type
export const typeDefs = gql`
  scalar JSON

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

// Define resolvers
export const resolvers = {
  JSON: GraphQLJSON,
  Query: {
    transactions: async () => {
      const transactions = await getTransactions();
      return transactions;
    },
  },
};