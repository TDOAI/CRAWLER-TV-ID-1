const mongoose = require("mongoose");

const id_with_errorsSchema = new mongoose.Schema({
    stream_id: { type: String, index: true }
},{versionKey: false})

const ID_With_Error = mongoose.model("ID_With_Error", id_with_errorsSchema);

module.exports = ID_With_Error;