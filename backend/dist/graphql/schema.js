"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvers = exports.typeDefs = void 0;
const graphql_tag_1 = require("graphql-tag");
const graphql_type_json_1 = require("graphql-type-json"); // You'll need to install this
const supabaseService_1 = require("../services/supabaseService");
// Define schema with JSON scalar type
exports.typeDefs = (0, graphql_tag_1.gql) `
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
exports.resolvers = {
    JSON: graphql_type_json_1.GraphQLJSON,
    Query: {
        transactions: async () => {
            const transactions = await (0, supabaseService_1.getTransactions)();
            return transactions;
        },
    },
};
