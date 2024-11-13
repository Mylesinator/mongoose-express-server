const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();
const PORT = process.env.port || 3000;

const app = express();
app.use(express.json());

// import the collection models
const GroceryItem = require("./models/GroceryItem");
const Employee = require("./models/Employee");
// create a mapping object based on the models
const modelMapping = {
    GroceryInventory: GroceryItem,
    Employees: Employee,
};

const connections = {}
const models = {}

const bankUserSchema = new mongoose.Schema({});

const getConnection = async (dbName) => {
    console.log(`getConnection called with ${dbName}`);

    if (!connections[dbName]) {
        connections[dbName] = await mongoose.createConnection(process.env.MONGO_URI, { dbName: dbName, autoIndex: false });

        await new Promise((resolve, reject) => {
            connections[dbName].once("open", resolve);
            connections[dbName].once("error", reject);
        });

        console.log(`A new database has been created for ${dbName}`);
    } else {
        console.log(`Reusing existing connection for ${dbName}`);
    }

    return connections[dbName];
}

const getModel = async (dbName, collectionName) => {
    console.log("getModel called with:", { dbName, collectionName });
    const modelKey = `${dbName}-${collectionName}`;

    if (!models[modelKey]) {
        const connection = await getConnection(dbName);

        // Create a dynamic schema that accepts any fields
        const Model = modelMapping[collectionName];

        if (!Model) {
            // Use a dynamic schema with autoIndex disabled if no model is found
            const dynamicSchema = new mongoose.Schema(
                {},
                { strict: false, autoIndex: false, versionKey: false }
            );
            models[modelKey] = connection.model(
                collectionName,
                dynamicSchema,
                collectionName
            );
            console.log(`Created dynamic model for collection: ${collectionName}`);
        } else {
            // Use the predefined model's schema with autoIndex already disabled
            models[modelKey] = connection.model(
                Model.modelName,
                Model.schema,
                collectionName // Use exact collection name from request
            );
            console.log("Created new model for collection:", collectionName);
        }
    }

    return models[modelKey];
}

app.get("/find/:database/:collection", async (req, res) => {
    try {
        const { database, collection } = req.params;
        const Model = await getModel(database, collection);

        const documents = await Model.find({});
        console.log(`Query executed, document count is: ${documents.length}`);

        return res.status(200).json(documents);
    } catch (error) {
        console.error(`Error in GET route:`, error);
        return res.status(500).json({ error: error.message });
    }
});

// DELETE route to delete a specific collection in a database
app.delete("/delete-collection/:database/:collection", async (req, res) => {
    try {
        const { database, collection } = req.params;
        const connection = await getConnection(database); // Establish or retrieve the connection

        // Check if the collection exists
        const collections = await connection.db.listCollections({ name: collection }).toArray();
        const collectionExists = collections.length > 0;

        if (!collectionExists) {
            return res
                .status(404)
                .json({
                    error: `Collection '${collection}' does not exist in database '${database}'.`,
                });
        }

        // Drop the collection
        await connection.db.dropCollection(collection);
        console.log(
            `Collection '${collection}' deleted from database '${database}'.`
        );

        // Remove the model associated with this collection
        const modelKey = `${database}-${collection}`;
        delete models[modelKey];
        
        res.status(200).json({
            message: `Collection '${collection}' has been successfully deleted from database '${database}`
        });
    } catch (err) {
        console.error("Error deleting collection:", err);
        res.status(500).json({ error: "An error occurred while deleting the collection." });
    }
});

app.post("/insert/:database/:collection", async (req, res) => {
    try {
        const { database, collection } = req.params;
        const { document } = req.body;
        const Model = await getModel(database, collection);

        Model.create(document).then((doc) => {
            console.log(doc);
            console.log("Document inserted");
        }).catch(err => console.error(err.message));
    } catch (error) {
        console.error(`Error in POST route:`, error);
        return res.status(500).json({ error: error.message });
    }
});

app.delete("/delete/:database/:collection/:id", async (req, res) => {
    try {
        const { database, collection, id } = req.params;
        const Model = await getModel(database, collection);

        const document = await Model.findById(id);
        await Model.deleteOne(document);
    } catch (error) {
        console.error(`Error in DELETE route:`, error);
        return res.status(500).json({ error: error.message });
    }
});

async function startServer() {
    try {
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        })
    } catch (error) {
        console.error(`Error starting server:`, error);
        process.exit(1);
    }
}

startServer();