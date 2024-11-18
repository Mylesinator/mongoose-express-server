const mongoose = require("mongoose");

const grocerySchema = new mongoose.Schema({
    item: {
        type: String,
        required: [true, "Item name is required"]
    },
    food_group: {
        type: String,
        required: [true, "food_group is required"],
        enum: ["fruits", "dairy", "proteins", "vegetables", "nuts", "grains"]
    },
    price_in_usd: {
        type: Number,
        required: [true, "price_in_usd is required"],
        min: [0, "Price must be a positive number"]
    }
});

module.exports = mongoose.model("GroceryItem", grocerySchema);