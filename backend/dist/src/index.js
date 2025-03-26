"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const transactionRoutes_1 = __importDefault(require("./routes/transactionRoutes"));
const batchRoutes_1 = __importDefault(require("./routes/batchRoutes"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const errorHandler_1 = require("./middleware/errorHandler");
const auth_1 = require("./middleware/auth");
const server_1 = require("@apollo/server");
const express4_1 = require("@apollo/server/express4");
const schema_1 = require("./graphql/schema");
const body_parser_1 = require("body-parser");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 8000;
app.use(express_1.default.json());
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    next();
});
app.get("/", (req, res) => {
    res.json({ message: "Welcome to the Payment Simulator API!" });
});
app.use("/api", authRoutes_1.default);
app.use("/api", transactionRoutes_1.default);
app.use("/api", batchRoutes_1.default);
const apolloServer = new server_1.ApolloServer({
    typeDefs: schema_1.typeDefs,
    resolvers: schema_1.resolvers,
});
const startServer = async () => {
    await apolloServer.start();
    app.use("/graphql", (0, body_parser_1.json)(), auth_1.authenticateToken, (0, express4_1.expressMiddleware)(apolloServer, {
        context: async ({ req, res }) => ({
            req,
            res,
        }),
    }));
};
startServer().catch(console.error);
app.use(errorHandler_1.errorHandler);
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`GraphQL endpoint available at http://localhost:${PORT}/graphql`);
});
