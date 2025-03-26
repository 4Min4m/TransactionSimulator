"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvers = exports.typeDefs = void 0;
const graphql_tag_1 = require("graphql-tag"); // تغییر به graphql-tag
const supabaseService_1 = require("../services/supabaseService");
// تعریف اسکیما
exports.typeDefs = (0, graphql_tag_1.gql) `
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
// تعریف Resolverها
exports.resolvers = {
    Query: {
        transactions: async () => {
            const transactions = await (0, supabaseService_1.getTransactions)();
            return transactions;
        },
    },
};
