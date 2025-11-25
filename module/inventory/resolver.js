// src/module/inventory/inventory.resolver.js (o donde lo tengas)
import connection from "../../Config/connectionSQL.js";
import { GraphQLError } from "graphql";

const inventoryResolver = {
  Query: {
    GetCategorias: async () => {
      try {
        const [categorias] = await connection.query(
          "SELECT id, nombre_cat FROM categorias"
        );
        return categorias;
      } catch (error) {
        console.error("Error al obtener categorías:", error);
        throw new GraphQLError("No se pudieron obtener las categorías", {
          extensions: { code: "BAD_REQUEST", http: { status: 400 } },
        });
      }
    },

    GetInventory: async () => {
      try {
        const [Productos] = await connection.query(
          `
          SELECT
            p.id,
            p.descripcion AS nombre,
            c.nombre_cat AS categoria,
            p.status,
            p.stock_Actual AS stockActual,
            p.stock_Minimo AS stockMinimo
          FROM productos p
          LEFT JOIN categorias c ON p.categoria = c.id
          where status=1
          `
        );
        return Productos;
      } catch (error) {
        console.error(error);
        throw new GraphQLError(
          "Error al obtener los productos de los inventarios",
          { extensions: { code: "BAD_REQUEST", http: { status: 400 } } }
        );
      }
    },

    GetAjustesInventario: async () => {
      try {
        const [AjusteInventario] = await connection.query(
          `
      SELECT ai.id ,
      ai.idProducto as idProducto,
       p.descripcion AS nombreProducto ,
       ai.stock, ai.nuevoStock,
       ai.nota,DATE_FORMAT(ai.fecha, '%Y-%m-%d %H:%i:%s') AS fecha ,
       ai.idUsuario as idUsuario,
       u.nombre as agente
       FROM ajustes_inventario ai 
       INNER JOIN productos p ON p.id = ai.idProducto
       INNER JOIN usuarios u ON u.id= ai.idUsuario
          `
        );
        return AjusteInventario;
      } catch (error) {
        console.error(error);
        throw new GraphQLError(
          "Error al obtener los ajustes de inventario",
          { extensions: { code: "BAD_REQUEST", http: { status: 400 } } }
        );
      }
    },
  },

  Mutation: {
    // 🔹 Crear categoría
    CreateCategoria: async (_, { input }) => {
      try {
        const { nombre_cat } = input;

        if (!nombre_cat || !nombre_cat.trim()) {
          throw new GraphQLError("El nombre de la categoría es obligatorio", {
            extensions: { code: "BAD_REQUEST", http: { status: 400 } },
          });
        }

        const [insertResult] = await connection.query(
          "INSERT INTO categorias (nombre_cat) VALUES (?)",
          [nombre_cat.trim()]
        );

        const [rows] = await connection.query(
          "SELECT id, nombre_cat FROM categorias WHERE id = ?",
          [insertResult.insertId]
        );

        if (!rows.length) {
          throw new GraphQLError(
            "No se pudo obtener la categoría recién creada",
            {
              extensions: {
                code: "INTERNAL_SERVER_ERROR",
                http: { status: 500 },
              },
            }
          );
        }

        return rows[0];
      } catch (error) {
        console.error("Error al crear categoría:", error);
        if (error instanceof GraphQLError) throw error;

        throw new GraphQLError("Error al crear categoría", {
          extensions: { code: "BAD_REQUEST", http: { status: 400 } },
        });
      }
    },

    // 🔹 Crear producto
    CreateProducto: async (_, { input }) => {
      try {
        const {
          descripcion,
          categoriaId,
          stockActual,
          stockMinimo,
          status,
        } = input;

        if (!descripcion || !descripcion.trim()) {
          throw new GraphQLError("La descripción del producto es obligatoria", {
            extensions: { code: "BAD_REQUEST", http: { status: 400 } },
          });
        }

        if (!categoriaId) {
          throw new GraphQLError("La categoría es obligatoria", {
            extensions: { code: "BAD_REQUEST", http: { status: 400 } },
          });
        }

        const stockActualNum = Number(stockActual ?? 0);
        const stockMinimoNum = Number(stockMinimo ?? 0);
        const statusNum = status ?? 1; // por defecto activo

        const [insertResult] = await connection.query(
          `
          INSERT INTO productos
            (descripcion, categoria, status, stock_Actual, stock_Minimo)
          VALUES (?, ?, ?, ?, ?)
          `,
          [
            descripcion.trim(),
            categoriaId,
            statusNum,
            stockActualNum,
            stockMinimoNum,
          ]
        );

        const [rows] = await connection.query(
          `
          SELECT
            p.id,
            p.descripcion AS nombre,
            c.nombre_cat AS categoria,
            p.status,
            p.stock_Actual AS stockActual,
            p.stock_Minimo AS stockMinimo
          FROM productos p
          LEFT JOIN categorias c ON p.categoria = c.id
          WHERE p.id = ?
          `,
          [insertResult.insertId]
        );

        if (!rows.length) {
          throw new GraphQLError(
            "No se pudo obtener el producto recién creado",
            {
              extensions: {
                code: "INTERNAL_SERVER_ERROR",
                http: { status: 500 },
              },
            }
          );
        }

        return rows[0];
      } catch (error) {
        console.error("Error al crear producto:", error);
        if (error instanceof GraphQLError) throw error;

        throw new GraphQLError("Error al crear producto", {
          extensions: { code: "BAD_REQUEST", http: { status: 400 } },
        });
      }
    },
    AjustarStockProducto: async (_, { input }, ctx) => {
      try {
        // Validar usuario con el mismo patrón que ya usas
        if (!ctx.usuario) {
          throw new GraphQLError("No autorizado", {
            extensions: {
              code: "UNAUTHORIZED",
              http: { status: 401 },
            },
          });
        }

        const idUsuario = ctx.usuario.idUsuario ?? ctx.usuario.id;
        if (!idUsuario) {
          throw new GraphQLError(
            "No se encontró el id del usuario en el token",
            {
              extensions: {
                code: "UNAUTHORIZED",
                http: { status: 401 },
              },
            }
          );
        }

        const { idProducto, nuevoStock, nota } = input;

        // 1) Obtener stock actual del producto
        const [prodRows] = await connection.query(
          `
          SELECT
            p.id,
            p.descripcion,
            p.stock_Actual,
            p.stock_Minimo,
            p.status,
            p.categoria
          FROM productos p
          WHERE p.id = ?
          `,
          [idProducto]
        );

        if (!prodRows.length) {
          throw new GraphQLError("Producto no encontrado", {
            extensions: { code: "NOT_FOUND", http: { status: 404 } },
          });
        }

        const producto = prodRows[0];
        const stockAnterior = Number(producto.stock_Actual ?? 0);
        const nuevoStockNum = Number(nuevoStock ?? 0);

        // 2) Insertar en AJUSTE_INVENTARIO
        await connection.query(
          `
          INSERT INTO ajustes_inventario
            (idUsuario, idProducto, stock, nuevoStock, nota, fecha)
          VALUES (?, ?, ?, ?, ?, NOW())
          `,
          [
            idUsuario,
            idProducto,
            stockAnterior,
            nuevoStockNum,
            nota ?? null,
          ]
        );

        // 3) Actualizar stock del producto
        await connection.query(
          `
          UPDATE productos
          SET stock_Actual = ?
          WHERE id = ?
          `,
          [nuevoStockNum, idProducto]
        );

        // 4) Devolver el producto actualizado con el mismo shape de GetInventory
        const [rows] = await connection.query(
          `
          SELECT
            p.id,
            p.descripcion AS nombre,
            c.nombre_cat AS categoria,
            p.status,
            p.stock_Actual AS stockActual,
            p.stock_Minimo AS stockMinimo
          FROM productos p
          LEFT JOIN categorias c ON p.categoria = c.id
          WHERE p.id = ?
          `,
          [idProducto]
        );

        if (!rows.length) {
          throw new GraphQLError(
            "No se pudo obtener el producto después del ajuste",
            {
              extensions: {
                code: "INTERNAL_SERVER_ERROR",
                http: { status: 500 },
              },
            }
          );
        }

        return rows[0];
      } catch (error) {
        console.error("Error al ajustar stock:", error);
        if (error instanceof GraphQLError) throw error;

        throw new GraphQLError("Error al ajustar stock", {
          extensions: { code: "BAD_REQUEST", http: { status: 400 } },
        });
      }
    },
  },
};

export default inventoryResolver;
