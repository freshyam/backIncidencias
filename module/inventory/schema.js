const inventorySchema = `#graphql
type Categoria {
  id: ID!
  nombre_cat: String!
}

type Producto {
  id: ID!
  nombre: String!
 
  categoria: String
  status: Int!
  stockActual: Int!
  stockMinimo: Int!
}

input CreateCategoriaInput {
  nombre_cat: String!
}

input CreateProductoInput {
  descripcion: String!
  categoriaId: ID!
  stockActual: Int!
  stockMinimo: Int!
  status: Int
}

input AjustarStockInput {
  idProducto: ID!
  nuevoStock: Int!
  nota: String
}

type AjusteInventario {
  id: ID!
  idUsuario: ID!
  agente: String
  idProducto: ID!
  nombreProducto: String
  stock: Int!
  nuevoStock: Int!
  nota: String
  fecha: String
}

type UpdateProductoResponse {
  success: Boolean!
  message: String!
  producto: Producto
}

type Query {
  GetCategorias: [Categoria!]!
  GetInventory: [Producto!]!
  GetAjustesInventario: [AjusteInventario]
}

type Mutation {
  CreateCategoria(input: CreateCategoriaInput!): Categoria!
  CreateProducto(input: CreateProductoInput!): Producto!
  AjustarStockProducto(input: AjustarStockInput!): Producto!
  updateProducto(
    id: ID!
    descripcion: String
    categoria: String
    stockActual: Int
    stockMinimo: Int
  ): UpdateProductoResponse!
}
`;

export default inventorySchema;
