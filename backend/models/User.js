import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    // User's display name.
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    // User's unique email address.
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // User's password; hashing will be added separately.
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    // User's age in years.
    age: {
      type: Number,
    },
    // User's self-identified gender.
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
    },
    // User's weight.
    weight: {
      type: Number,
    },
    // User's height.
    height: {
      type: Number,
    },
    // User's blood group.
    bloodGroup: {
      type: String,
    },
    // User's declared allergies.
    allergies: {
      type: [String],
      default: [],
    },
    // User's declared chronic diseases.
    chronicDiseases: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model('User', userSchema);
