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
        // Extract the database and collection from request parameters
        const { database, collection } = req.params;
        // Get the appropriate Mongoose model
        const Model = await getModel(database, collection);

        // Retrieve all documents from the collection
        const documents = await Model.find({});
        // Log the number of documents retrieved
        console.log(`Query executed, document count is: ${documents.length}`);

        // Send back the documents with a 200 status code
        return res.status(200).json(documents);
    } catch (error) {
        // Log error to the console
        console.error(`Error in GET route:`, error);
        // Send back a 500 status code with the error message
        return res.status(500).json({ error: error.message });
    }
});

app.post('/insert/:database/:collection', async (req, res) => {
    try {
        // Extract the request parameters using destructuring
        const { database, collection } = req.params;
        // Get the request body and store it as data
        const data = req.body;
        // Get the appropriate Mongoose model
        const Model = await getModel(database, collection);
        // Create a new instance of that model with the data
        const document = new Model(data);
        // Save the new document to the database
        await document.save();
        // Log a success message to the console
        console.log("Successfully saved document");
        // Send back the newly created document as JSON with a 201 status code
        res.status(201).json(document);
    } catch (err) {
        // Log any errors to the console
        console.error("Error in POST route", err);
        // Send back a 400 status code and the error message in the response
        res.status(400).json({ error: err.message });
    }
});

app.put('/update/:database/:collection/:id', async (req, res) => {
    try {
        // Extract the database, collection, and id from request parameters
        const { database, collection, id } = req.params;
        // Get the request body as data
        const data = req.body;
        // Get the appropriate Mongoose model
        const Model = await getModel(database, collection);
        // Find the document by id and update it
        const updatedDocument = await Model.findByIdAndUpdate(id, data, { new: true, runValidators: true });
        // If document was not found, early return with a 404 status and error message
        if (!updatedDocument) {
            return res.status(404).json({ error: "Document not found" });
        }
        // Log a success message to the console
        console.log("Succesfully updated document");
        // Send back the updated document with a 200 status code
        res.status(200).json(updatedDocument);
    } catch (err) {
        // Log error to the console
        console.error("Error in PUT route", err);
        // Send back a 400 status code with the error message
        res.status(400).json({ error: err.message });
    }
});

app.delete('/delete/:database/:collection/:id', async (req, res) => {
    try {
        // Extract the database, collection, and id from request parameters
        const { database, collection, id } = req.params;
        // Get the appropriate Mongoose model
        const Model = await getModel(database, collection);
        // Find and delete the document by id
        const deletedDocument = await Model.findByIdAndDelete(id);
        // If document not found, return 404 status code with error message
        if (!deletedDocument) {
            return res.status(404).json({ error: "Document not found" });
        }
        // Log success message to the console
        console.log("Successfully deleted document");
        // Send back a success message with a 200 status code
        res.status(200).json({ message: "Succesfully deleted document" });
    } catch (err) {
        // Log error to the console
        console.error("Error in DELETE document route", err);
        // Send back a 400 status code with the error message
        res.status(400).json({ error: err.message });
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

// app.post("/insert/:database/:collection", async (req, res) => {
//     try {
//         // Extract the request parameters using destructuring
//         const { database, collection } = req.params;
//         // Get the request body and store it as data
//         const { document } = req.body;
//         // Get the appropriate Mongoose model
//         const Model = await getModel(database, collection);

//         // Create a new instance of that model with the data
//         // and save the new document to the database
//         Model.create(document).then((doc) => {
//             // Log a success message to the console
//             console.log("Document saved successfully")
//             // Send back the newly created document as JSON with a 201 status code
//             res.status(201).json(doc);
//         }).catch(err => console.error(err.message));
//     } catch (error) {
//         // Log any errors to the console
//         console.error(`Error in POST route:`, error);
//         // Send back a 400 status code and the error message in the response
//         return res.status(400).json({ error: error.message });
//     }
// });

// app.delete("/delete/:database/:collection/:id", async (req, res) => {
//     try {
//         const { database, collection, id } = req.params;
//         const Model = await getModel(database, collection);

//         const document = await Model.findById(id);
//         await Model.deleteOne(document);
//     } catch (error) {
//         console.error(`Error in DELETE route:`, error);
//         return res.status(500).json({ error: error.message });
//     }
// });

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