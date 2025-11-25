const incidentsSchema = `#graphql
  type Incident {
    id: ID!
    titulo: String
    descripcion: String
    reporta: String
    prioridad: String
    status: Int
    fecha: String
    idAgente: Int
    agente: String
  }

  input IncidentInput {
    id:Int
    titulo: String!
    descripcion: String!
    reporta: String!
    prioridad: String!
    status: Int
  }



  type Query {
    GetIncidents: [Incident!]!
  }

  type Mutation {
    CreateIncident(input: IncidentInput!): Incident!
    UpdateIncidentStatus(id: ID!, status: Int!): Incident
    
  }
`;
export default incidentsSchema;
