import connection from "../../Config/connectionSQL.js";
import { GraphQLError } from "graphql";
import mazatlanHora from "../../functions/MazatlanHora.js";

const mapMunicipio = (id) => {
  if (id === 1) return { table: "inventario_rosario", ubic: "rosario" };
  if (id === 2) return { table: "inventario_escuinapa", ubic: "escuinapa" };
  return null;
};

const buildNota = (fromUbic, toUbic) =>
  `transferencia de ${fromUbic.toUpperCase()} a ${toUbic.toUpperCase()}`;





const inventoryResolver = {
    Query : {
        getPendingInventory: async (_,{tipo}) => {
            try {
                
                if( tipo === 1 ) {
                    const [pendingInventory] = await connection.query(
                        `   
                            SELECT SUM(stock) AS stock, 
                                (SELECT SUM(min_stock - stock)
                                FROM inventario_rosario
                                WHERE stock < min_stock) AS productos_pendientes,
                                (SELECT COUNT(*) FROM inventario_rosario WHERE stock < min_stock) AS productos
                                FROM inventario_rosario;
                        `, []
                    );

                    return [
                        {
                            name: "Disponible",
                            value: pendingInventory[0].stock,
                            color: "#10b981",
                            description: "Productos en stock",
                            productos: pendingInventory[0].stock
                        },
                        {
                            name: "Faltante",
                            value: pendingInventory[0].productos_pendientes,
                            color: "#ef4444",
                            description: "Productos agotados",
                            productos: pendingInventory[0].productos
                        },
                    ]
                } else{
                    const [pendingInventory] = await connection.query(
                        `   
                            SELECT SUM(stock) AS stock, 
                                (SELECT SUM(min_stock - stock)
                                FROM inventario_escuinapa
                                WHERE stock < min_stock) AS productos_pendientes,
                                (SELECT COUNT(*) FROM inventario_escuinapa WHERE stock < min_stock) AS productos
                                FROM inventario_escuinapa;
                        `, []
                    );

                    return [
                        {
                            name: "Disponible",
                            value: pendingInventory[0].stock,
                            color: "#10b981",
                            description: "Productos en stock",
                            productos: pendingInventory[0].stock
                        },
                        {
                            name: "Faltante",
                            value: pendingInventory[0].productos_pendientes,
                            color: "#ef4444",
                            description: "Productos agotados",
                            productos: pendingInventory[0].productos
                        },
                    ]
                }
                
            } catch (error) {
                console.log(error);
                throw new GraphQLError("Error al obtener el inventario pendiente.",{
                    extensions:{
                        code: "BAD_REQUEST",
                        http: {
                            "status" : 400
                        }
                    }
                });
                
            }
        },
        getCategories: async (_,{  }) => {
            try {
                
                const [categorias] = await connection.query(
                    `   
                        SELECT 0 AS idCategoria, "Todas" AS descripcion
                            UNION
                            SELECT * FROM categorias
                    `, []
                );
 
                return categorias;
            } catch (error) {
                console.log(error);
                throw new GraphQLError("Error al obtener las categorías.",{
                    extensions:{
                        code: "BAD_REQUEST",
                        http: {
                            "status" : 400
                        }
                    }
                });
                
            }
        },
        getProducts: async (_,{ categoria, municipio }) => {

            let where = "";

            if(categoria !== 0){
                where = `AND p.categoria = ${categoria}`
            }

            try {
                if(municipio === 1 ){
                   
                    const [productos] = await connection.query(

                        `   
                            SELECT p.*, ir.stock 
                                FROM productos p
                                INNER JOIN inventario_rosario ir ON p.idProducto = ir.idProducto
                                WHERE ir.stock > 0 ${where}
                        `,
                    );

                    return productos;
                    
                }else{

                    const [productos] = await connection.query(

                        `   
                            SELECT p.*, ie.stock 
                                FROM productos p
                                INNER JOIN inventario_escuinapa ie ON p.idProducto = ie.idProducto
                                WHERE ie.stock > 0 ${where}
                        `,
                    );

                    return productos;
                }
 
            } catch (error) {
                console.log(error);
                throw new GraphQLError("Error al obtener las categorías.",{
                    extensions:{
                        code: "BAD_REQUEST",
                        http: {
                            "status" : 400
                        }
                    }
                });
                
            }
        },
        getCategorias: async (_, __, { }) => {
            try {
                const [categorias] = await connection.query('SELECT * FROM categorias');
                return categorias;
            } catch (error) {
                console.error("Error al obtener categorías:", error);
                throw new Error("No se pudieron obtener las categorías");
            }
        },
        GetProductosInventarios: async (_, {}) => {
            try {
                const [productosInv] = await connection.query(
                    `  
                    SELECT 
                        p.idProducto,
                        p.descripcion AS nombre,
                        c.descripcion AS categoria,
                        p.precio,
                        p.img_producto,
                        p.status,
                        ir.stock AS stock_rosario,
                        ir.min_stock AS min_stock_rosario,
                        ie.stock AS stock_escuinapa,
                        ie.min_stock AS min_stock_escuinapa
                    FROM productos p
                    LEFT JOIN categorias c ON p.categoria = c.idcategoria
                    LEFT JOIN inventario_rosario ir ON p.idproducto = ir.idproducto
                    LEFT JOIN inventario_escuinapa ie ON p.idproducto = ie.idproducto;
                    `, 
                );

                return productosInv;
            } catch (error) {
                console.log(error);
                throw new GraphQLError("Error al obtener los productos de los inventarios", {
                    extensions: {
                        code: "BAD_REQUEST",
                        http: {
                            status: 400
                        }
                    }
                });
            }
        },
        getHistorialAjustes: async (_, __) => {
            try {
                const [ajustes] = await connection.query(
                    `
                        SELECT 
                            ai.id,
                            ai.idProducto,
                            p.descripcion AS producto,
                            ai.idUsuario,
                            u.nombre AS usuario,
                            ai.ubicacion,
                            ai.stock AS stockAnterior,
                            ai.nuevoStock AS cantidad,
                            ai.nota,
                            DATE_FORMAT(ai.fecha, '%Y-%m-%d %H:%i') AS fecha
                            FROM ajustes_inventario ai
                            INNER JOIN productos p ON ai.idProducto = p.idProducto
                            INNER JOIN usuarios u ON ai.idUsuario = u.idUsuario
                            ORDER BY ai.fecha DESC;
                    `
                );

                return ajustes;
            } catch (error) {
                console.error("Error al obtener historial:", error);
                throw new GraphQLError("No se pudo obtener el historial de ajustes", {
                    extensions: {
                        code: "BAD_REQUEST",
                        http: { status: 400 },
                    },
                });
            }
        },
        getMunicipiosActivos: async () => {
            try {
                const [rows] = await connection.query(
                `
                    SELECT idMunicipio, nombre
                    FROM municipios
                    WHERE status = 1
                    ORDER BY nombre
                `
                );

            
                return rows.map(r => ({
                idMunicipio: Number(r.idMunicipio),
                nombre: r.nombre,
                }));
            } catch (error) {
                console.error("Error al obtener municipios activos:", error);
                throw new GraphQLError("Error al obtener municipios activos.", {
                extensions: {
                    code: "BAD_REQUEST",
                    http: { status: 400 },
                },
                });
            }
            },
        getProductosPorMunicipio: async (_,{ idMunicipio }) => {
                try {
                    
                    if (idMunicipio !== 1 && idMunicipio !== 2) {
                        throw new GraphQLError("idMunicipio inválido: usa 1 (Rosario) o 2 (Escuinapa).", {
                            extensions: { code: "BAD_USER_INPUT", http: { status: 400 } },
                        });
                    }

                    const [rows] = await connection.query(
                        `
                        SELECT  
                            p.idProducto,
                            p.descripcion AS nombre,
                            p.precio,
                            p.img_producto,
                            c.descripcion AS categoria,
                            CASE WHEN ? = 1 THEN ir.stock    ELSE ie.stock    END AS stock,
                            CASE WHEN ? = 1 THEN ir.min_stock ELSE ie.min_stock END AS min_stock
                        FROM productos p
                        LEFT JOIN categorias c          ON c.idCategoria = p.categoria
                        LEFT JOIN inventario_rosario ir ON ir.idProducto = p.idProducto
                        LEFT JOIN inventario_escuinapa ie ON ie.idProducto = p.idProducto
                        WHERE p.status = 1
                        AND (
                                (? = 1 AND ir.stock > 0)
                            OR (? = 2 AND ie.stock > 0)
                        )
                        ORDER BY p.descripcion
                        `,
                        [idMunicipio, idMunicipio, idMunicipio, idMunicipio]
                    );

                    return rows.map(r => ({
                        idProducto: Number(r.idProducto),
                        nombre: r.nombre,
                        precio: Number(r.precio),
                        img_producto: r.img_producto ?? null,
                        categoria: r.categoria ?? null,
                        stock: r.stock !== null ? Number(r.stock) : 0,
                        min_stock: r.min_stock !== null ? Number(r.min_stock) : 0,
                    }));
                } catch (error) {
                    console.error("Error getProductosPorMunicipio:", error);
                    throw new GraphQLError("Error al obtener productos por municipio.", {
                        extensions: { code: "BAD_REQUEST", http: { status: 400 } },
                    });
                }
            },





    },

     Mutation: { 
        actualizarStockEscuinapa: async (_, { idProducto, nuevoStock, nota }, ctx) => {
            try {
                
                const [productoActivo] = await connection.query(
                    `SELECT status FROM productos WHERE idProducto = ?`,
                    [idProducto]
                );

                if (productoActivo.length === 0 || productoActivo[0].status !== 1) {
                    throw new GraphQLError("El producto está inactivo o no existe.");
                }

                
                const [stockResult] = await connection.query(
                    `SELECT stock FROM inventario_escuinapa WHERE idProducto = ?`,
                    [idProducto]
                );

                if (stockResult.length === 0) {
                    throw new GraphQLError("No se encontró el producto en Escuinapa.");
                }

                const stockAnterior = stockResult[0].stock;

                
                const [updateResult] = await connection.query(
                    `UPDATE inventario_escuinapa SET stock = ? WHERE idProducto = ?`,
                    [nuevoStock, idProducto]
                );

                if (updateResult.affectedRows === 0) {
                    throw new GraphQLError("Error al actualizar el producto.");
                }

                
                await connection.query(
                    `INSERT INTO ajustes_inventario (idProducto, idUsuario, ubicacion, stock, nuevoStock, nota, fecha)
                    VALUES (?, ?, 'escuinapa', ?, ?, ?, ?)`,
                    [idProducto, ctx.usuario.idUsuario, stockAnterior, nuevoStock, nota, mazatlanHora()]
                );

                return {
                    success: true,
                    message: "Stock actualizado correctamente en inventario_escuinapa",
                };
            } catch (error) {
                console.error("Error al actualizar el stock en Escuinapa:", error);
                throw new GraphQLError("Error al actualizar el stock en Escuinapa", {
                    extensions: {
                        code: "BAD_REQUEST",
                        http: { status: 400 },
                    },
                });
            }
        },
        actualizarStockRosario: async (_, { idProducto, nuevoStock, nota }, ctx) => {
            try {
                
                const [productoActivo] = await connection.query(
                    `SELECT status FROM productos WHERE idProducto = ?`,
                    [idProducto]
                );

                if (productoActivo.length === 0 || productoActivo[0].status !== 1) {
                    throw new GraphQLError("El producto está inactivo o no existe.");
                }

                const [stockResult] = await connection.query(
                    `SELECT stock FROM inventario_rosario WHERE idProducto = ?`,
                    [idProducto]
                );

                if (stockResult.length === 0) {
                    throw new GraphQLError("No se encontró el producto en Rosario.");
                }

                const stockAnterior = stockResult[0].stock;

                const [updateResult] = await connection.query(
                    `UPDATE inventario_rosario SET stock= ? WHERE idProducto = ?`,
                    [nuevoStock, idProducto]
                );

                if (updateResult.affectedRows === 0) {
                    throw new GraphQLError("Error al actualizar el stock.");
                }

                await connection.query(
                    `INSERT INTO ajustes_inventario (idProducto, idUsuario, ubicacion, stock, nuevoStock, nota, fecha)
                    VALUES (?, ?, 'rosario', ?, ?, ?, ?)`,
                    [idProducto, ctx.usuario.idUsuario, stockAnterior, nuevoStock, nota, mazatlanHora()]
                );

                return {
                    success: true,
                    message: "Stock actualizado correctamente en inventario_rosario",
                };
            } catch (error) {
                console.error("Error al actualizar el stock en Rosario:", error);
                throw new GraphQLError("Error al actualizar el stock en Rosario", {
                    extensions: {
                        code: "BAD_REQUEST",
                        http: {
                            status: 400,
                        },
                    },
                });
            }
        },
        crearCategoria: async (_, { descripcion }) => {
            let conn;
            try {
                conn = await connection.getConnection(); 
                const [result] = await conn.query(
                    'INSERT INTO categorias (descripcion) VALUES (?)',
                    [descripcion.toUpperCase()]
                );

                return {
                    idCategoria: result.insertId,
                    descripcion,
                };
            } catch (error) {
                console.error("Error al crear categoría:", error);
                throw new GraphQLError("No se pudo crear la categoría", {
                    extensions: {
                        code: "BAD_REQUEST",
                        originalError: error.message,
                    },
                });
            } finally {
                if (conn) conn.release(); 
            }
        },
        crearProductoConInventarios: async (_, { descripcion, categoria, precio, img_producto, status,stockMinRosario, stockMinEscuinapa }) => {
            let conn;
            try {
                conn = await connection.getConnection();
                await conn.beginTransaction();

                const [result] = await conn.query(
                    `INSERT INTO productos (descripcion, categoria, precio,img_producto,status) VALUES (?, ?, ?,?,?)`,
                    [descripcion.toUpperCase(), categoria, precio,img_producto,status]
                );

                const idProducto = result.insertId;

                await conn.query(
                    `INSERT INTO inventario_rosario (idproducto, stock, min_stock) VALUES (?, ?, ?)`,
                    [idProducto, 0, stockMinRosario]
                );

                await conn.query(
                    `INSERT INTO inventario_escuinapa (idproducto, stock, min_stock) VALUES (?, ?, ?)`,
                    [idProducto, 0, stockMinEscuinapa]
                );

                await conn.commit();

                return {
                    idProducto,
                    descripcion,
                    categoria,
                    img_producto,
                    precio,
                    status
                };
            } catch (error) {
                if (conn) await conn.rollback();
                console.error("Error en la transacción:", error);
                throw new GraphQLError("Error al crear el producto en bodegas", {
                    extensions: {
                        code: "BAD_REQUEST",
                        http: {
                            status: 400,
                        },
                    },
                });
            } finally {
                if (conn) conn.release();
            }
        },
        eliminarProducto: async (_, { idProducto }) => {
            try {
                const [result] = await connection.query(
                    `UPDATE productos SET STATUS = 0 WHERE STATUS = 1 AND idProducto = ?`,
                    [idProducto]
                );

                if (result.affectedRows === 0) {
                    return {
                        success: false,
                        message: "No se encontró el producto o ya estaba eliminado.",
                    };
                }

                return {
                    success: true,
                    message: "Producto eliminado correctamente.",
                };
            } catch (error) {
                console.error("Error al eliminar producto:", error);
                throw new GraphQLError("Error al eliminar el producto", {
                    extensions: {
                        code: "BAD_REQUEST",
                    },
                });
            }
        },
        activarProducto: async (_, { idProducto }) => {
            try {
                const [result] = await connection.query(
                    `UPDATE productos SET STATUS = 1 WHERE STATUS = 0 AND idProducto = ?`,
                    [idProducto]
                );

                if (result.affectedRows === 0) {
                    return {
                        success: false,
                        message: "No se encontró el producto o ya estaba activo.",
                    };
                }

                return {
                    success: true,
                    message: "Producto activado correctamente.",
                };
            } catch (error) {
                console.error("Error al activar producto:", error);
                throw new GraphQLError("Error al activar el producto", {
                    extensions: {
                        code: "BAD_REQUEST",
                    },
                });
            }
        },
        updateProducto: async (_,
        {
            idProducto,
            descripcion,
            categoria,
            precio,
            img_producto,
            min_stock_rosario,
            min_stock_escuinapa
        }
        ) => {
            try {
                
                const [existing] = await connection.query(
                    `SELECT * FROM productos WHERE idProducto = ?`,
                    [idProducto]
                );

                if (existing.length === 0) {
                    throw new GraphQLError("Producto no encontrado.");
                }

                const updates = [];
                const values = [];

                if (descripcion !== undefined) {
                    updates.push("descripcion = ?");
                    values.push(descripcion.toUpperCase());
                }

                if (categoria !== undefined) {
                    updates.push("categoria = ?");
                    values.push(categoria);
                }

                if (precio !== undefined) {
                    updates.push("precio = ?");
                    values.push(precio);
                }

                if (img_producto !== undefined) {
                    updates.push("img_producto = ?");
                    values.push(img_producto);
                }

                if (updates.length > 0) {
                    values.push(idProducto);

                    await connection.query(
                        `UPDATE productos SET ${updates.join(", ")} WHERE idProducto = ?`,
                        values
                    );
                }

                if (min_stock_rosario !== undefined) {
                    await connection.query(
                        `UPDATE inventario_rosario SET min_stock = ? WHERE idProducto = ?`,
                        [min_stock_rosario, idProducto]
                    );
                }

                if (min_stock_escuinapa !== undefined) {
                    await connection.query(
                        `UPDATE inventario_escuinapa SET min_stock = ? WHERE idProducto = ?`,
                        [min_stock_escuinapa, idProducto]
                    );
                }

                const [updatedProduct] = await connection.query(
                    `SELECT 
                        p.idProducto, p.descripcion, p.categoria, p.precio, p.img_producto,
                        r.min_stock AS min_stock_rosario,
                        e.min_stock AS min_stock_escuinapa
                        FROM productos p
                        LEFT JOIN inventario_rosario r ON p.idProducto = r.idProducto
                        LEFT JOIN inventario_escuinapa e ON p.idProducto = e.idProducto
                        WHERE p.idProducto = ?`,
                    [idProducto]
                );

                return {
                    success: true,
                    message: "Producto actualizado correctamente.",
                    producto: updatedProduct[0],
                };
            } catch (error) {
                console.error("Error al actualizar el producto:", error);
                throw new GraphQLError("Error al actualizar el producto.", {
                    extensions: { code: "INTERNAL_SERVER_ERROR" },
                });
            }
        },
        transferirProductos: async (_, { fromMunicipio, toMunicipio, items, nota }, ctx) => {
               
                if (fromMunicipio === toMunicipio) {
                    throw new GraphQLError("El origen y destino no pueden ser iguales.", {
                    extensions: { code: "BAD_USER_INPUT", http: { status: 400 } },
                    });
                }
                const fromInfo = mapMunicipio(fromMunicipio);
                const toInfo = mapMunicipio(toMunicipio);
                if (!fromInfo || !toInfo) {
                    throw new GraphQLError("idMunicipio inválido: usa 1 (Rosario) o 2 (Escuinapa).", {
                    extensions: { code: "BAD_USER_INPUT", http: { status: 400 } },
                    });
                }
                if (!Array.isArray(items) || items.length === 0) {
                    throw new GraphQLError("Debes enviar al menos un artículo a transferir.", {
                    extensions: { code: "BAD_USER_INPUT", http: { status: 400 } },
                    });
                }

                let conn;
                try {
                    conn = await connection.getConnection();
                    await conn.beginTransaction();

                    const notaFinal = nota?.trim() || buildNota(fromInfo.ubic, toInfo.ubic);
                    const idUsuario = ctx?.usuario?.idUsuario ?? null; 

                    const results = [];

                    
                    for (const { idProducto, cantidad } of items) {
                    if (!Number.isInteger(idProducto) || !Number.isInteger(cantidad) || cantidad <= 0) {
                        throw new GraphQLError(
                        `Item inválido: idProducto=${idProducto}, cantidad=${cantidad}`,
                        { extensions: { code: "BAD_USER_INPUT", http: { status: 400 } } }
                        );
                    }

                    const [[fromRow]] = await conn.query(
                        `SELECT stock FROM ${fromInfo.table} WHERE idProducto = ? FOR UPDATE`,
                        [idProducto]
                    );
                    const [[toRow]] = await conn.query(
                        `SELECT stock FROM ${toInfo.table} WHERE idProducto = ? FOR UPDATE`,
                        [idProducto]
                    );

                    if (!fromRow) {
                        throw new GraphQLError(
                        `Producto ${idProducto} no existe en inventario de ${fromInfo.ubic}.`,
                        { extensions: { code: "BAD_REQUEST", http: { status: 400 } } }
                        );
                    }
                    if (!toRow) {
                       
                        throw new GraphQLError(
                        `Producto ${idProducto} no existe en inventario de ${toInfo.ubic}.`,
                        { extensions: { code: "BAD_REQUEST", http: { status: 400 } } }
                        );
                    }

                    const fromStockAnterior = Number(fromRow.stock) || 0;
                    const toStockAnterior = Number(toRow.stock) || 0;

                    if (fromStockAnterior < cantidad) {
                        throw new GraphQLError(
                        `Stock insuficiente para idProducto=${idProducto} en ${fromInfo.ubic}. Disponible: ${fromStockAnterior}, requerido: ${cantidad}.`,
                        { extensions: { code: "BAD_REQUEST", http: { status: 400 } } }
                        );
                    }

                    const fromNuevoStock = fromStockAnterior - cantidad;
                    const toNuevoStock = toStockAnterior + cantidad;

                    
                    const [updFrom] = await conn.query(
                        `UPDATE ${fromInfo.table} SET stock = ? WHERE idProducto = ?`,
                        [fromNuevoStock, idProducto]
                    );
                    if (updFrom.affectedRows === 0) {
                        throw new GraphQLError(
                        `No se pudo actualizar stock en ${fromInfo.ubic} para idProducto=${idProducto}.`,
                        { extensions: { code: "BAD_REQUEST", http: { status: 400 } } }
                        );
                    }

                    const [updTo] = await conn.query(
                        `UPDATE ${toInfo.table} SET stock = ? WHERE idProducto = ?`,
                        [toNuevoStock, idProducto]
                    );
                    if (updTo.affectedRows === 0) {
                        throw new GraphQLError(
                        `No se pudo actualizar stock en ${toInfo.ubic} para idProducto=${idProducto}.`,
                        { extensions: { code: "BAD_REQUEST", http: { status: 400 } } }
                        );
                    }

                    
                    await conn.query(
                        `INSERT INTO ajustes_inventario (idProducto, idUsuario, ubicacion, stock, nuevoStock, nota, fecha)
                        VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                        [idProducto, idUsuario, fromInfo.ubic, fromStockAnterior, fromNuevoStock, notaFinal]
                    );

                    await conn.query(
                        `INSERT INTO ajustes_inventario (idProducto, idUsuario, ubicacion, stock, nuevoStock, nota, fecha)
                        VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                        [idProducto, idUsuario, toInfo.ubic, toStockAnterior, toNuevoStock, notaFinal]
                    );

                    results.push({
                        idProducto,
                        fromStockAnterior,
                        fromNuevoStock,
                        toStockAnterior,
                        toNuevoStock,
                    });
                    }

                    await conn.commit();

                    return {
                    success: true,
                    message: `Transferencia completada de ${fromInfo.ubic.toUpperCase()} a ${toInfo.ubic.toUpperCase()}.`,
                    items: results,
                    };
                } catch (error) {
                    if (conn) await conn.rollback();
                    console.error("Error en transferirProductos:", error);
                    throw new GraphQLError("Error al transferir productos.", {
                    extensions: { code: "BAD_REQUEST", http: { status: 400 } },
                    });
                } finally {
                    if (conn) conn.release();
                }
                },



    }
    
};

export default inventoryResolver;
