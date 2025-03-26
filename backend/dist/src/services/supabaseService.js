"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransactions = void 0;
const supabaseClient_1 = require("../utils/supabaseClient");
const getTransactions = async () => {
    const { data, error } = await supabaseClient_1.supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false }) // order by time
        .limit(1); // only one record
    if (error)
        throw new Error(error.message);
    return data;
};
exports.getTransactions = getTransactions;
