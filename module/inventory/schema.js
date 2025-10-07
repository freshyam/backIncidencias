const inventorySchema = `#graphql

    type InventarioPendiente {
        name: String,
        value: Int,
        color: String,
        description: String
        productos: Int
    }

    type Categoria {
        idCategoria: Int
        descripcion: String
    }

    type Producto {
        idProducto: Int
        descripcion: String
        categoria: Int
        precio: Float
        img_producto: String
        stock: Int
        status: Int
    }
    type ProductoInventario {
        idProducto: Int!
        nombre: String!
        categoria: String
        precio: Float
        stock_rosario: Int
        min_stock_rosario: Int
        stock_escuinapa: Int
        min_stock_escuinapa: Int
        status: Int
        img_producto: String
    }
    type Ajuste {
        id: Int!
        idProducto: Int!
        producto: String!
        idUsuario: Int!
        usuario: String!
        ubicacion: String!
        cantidad: Int!
        stockAnterior: Int!
        nota: String
        fecha: String
    }
    type ResultadoMutation {
        success: Boolean!
        message: String!
    }

    type ProductoResponse {
        success: Boolean!
        message: String!
        producto: Producto
    }

    type UpdateProductoResponse {
        success: Boolean!
        message: String!
        producto: Producto
    }

    type ResponseMessage {
        success: Boolean
        message: String
    }
        
    type Municipio {
        idMunicipio: Int!
        nombre: String!
    }

    type ProductoResumen {
        idProducto: Int!
        nombre: String!
        precio: Float!
        img_producto: String
        categoria: String
        stock: Int!
        min_stock: Int!
        }    
    
     input TransferItemInput {
        idProducto: Int!
        cantidad: Int!
        }


    type TransferItemResult {
        idProducto: Int!
        fromStockAnterior: Int!
        fromNuevoStock: Int!
        toStockAnterior: Int!
        toNuevoStock: Int!
        }

    type TransferenciaResult {
    success: Boolean!
    message: String!
    items: [TransferItemResult!]!
    }







    type Query {
        getPendingInventory(tipo: Int): [InventarioPendiente]
        getCategories: [Categoria]
        getCategorias: [Categoria]
        getProducts(categoria: Int, municipio: Int): [Producto]
        GetProductosInventarios: [ProductoInventario]
        getHistorialAjustes: [Ajuste]
        getMunicipiosActivos: [Municipio!]!
        getProductosPorMunicipio(idMunicipio: Int!): [ProductoResumen!]!
    }
    type Mutation {
        actualizarStockRosario(idProducto: Int!, nuevoStock: Int!, nota: String!): ResultadoMutation
        actualizarStockEscuinapa(idProducto: Int!, nuevoStock: Int!, nota: String!): ResultadoMutation

        crearCategoria(descripcion: String!): Categoria!

        crearProductoConInventarios(
            descripcion: String!,
            categoria: Int!,
            precio: Float!,
            img_producto: String,
            stockMinRosario: Int!,
            stockMinEscuinapa: Int!
            status: Int = 1
        ): Producto!

        eliminarProducto(idProducto: Int!): ProductoResponse
            
        activarProducto(idProducto: Int!): ProductoResponse
        
        updateProducto(
            idProducto: Int!
            descripcion: String
            categoria: Int
            precio: Float
            img_producto: String
            min_stock_rosario: Int
            min_stock_escuinapa: Int
        ): UpdateProductoResponse
       

        transferirProductos(
                fromMunicipio: Int!
                toMunicipio: Int!
                items: [TransferItemInput!]!
                nota: String
            ): TransferenciaResult!

      }
     
       
            
   
    
`
export default inventorySchema;
