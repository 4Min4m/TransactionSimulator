"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const server_1 = require("@apollo/server");
const express4_1 = require("@apollo/server/express4");
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const transactionRoutes_1 = __importDefault(require("./routes/transactionRoutes"));
const batchRoutes_1 = __importDefault(require("./routes/batchRoutes"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const errorHandler_1 = require("./middleware/errorHandler");
const schema_1 = require("./graphql/schema");
// لود متغیرهای محیطی
dotenv_1.default.config({ path: "./.env" });
console.log("Env vars:", {
    PORT: process.env.PORT,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY,
});
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        const allowedOrigins = ["*"];
        if (!origin || allowedOrigins.includes(origin) || origin.includes(".app.github.dev")) {
            callback(null, true);
        }
        else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
}));
app.options("*", (0, cors_1.default)()); // برای Preflight
app.use(body_parser_1.default.json());
app.use("/api", transactionRoutes_1.default);
app.use("/api", batchRoutes_1.default);
app.use("/api", authRoutes_1.default);
const server = new server_1.ApolloServer({
    typeDefs: schema_1.typeDefs,
    resolvers: schema_1.resolvers,
});
async function startServer() {
    await server.start();
    app.use("/graphql", (0, express4_1.expressMiddleware)(server));
    app.use(errorHandler_1.errorHandler);
    const PORT = process.env.PORT || 8000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
    });
}
startServer();
