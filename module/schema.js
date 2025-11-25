import { makeExecutableSchema } from "@graphql-tools/schema";
import { mergeTypeDefs, mergeResolvers } from "@graphql-tools/merge";

import authenticationResolver from "./authentication/resolver.js";
import authenticationSchema from "./authentication/schema.js";

import incidentsResolver from "./incidents/resolver.js";
import incidentsSchema from "./incidents/schema.js";

import inventorySchema from "./inventory/schema.js"
import inventoryResolver from "./inventory/resolver.js";




const typeDefs = mergeTypeDefs([authenticationSchema, incidentsSchema, inventorySchema]);
const resolvers = mergeResolvers([authenticationResolver, incidentsResolver, inventoryResolver]);

const schema = makeExecutableSchema({
    typeDefs,
    resolvers
})

export default schema;