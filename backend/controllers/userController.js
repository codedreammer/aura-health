import User from '../models/User.js';

const withoutPassword = (user) => {
  const userObject = user.toObject();
  delete userObject.password;
  return userObject;
};

export const getUserProfile = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: withoutPassword(req.user),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const user = req.user;
    const allowedFields = [
      'fullName',
      'age',
      'gender',
      'weight',
      'height',
      'bloodGroup',
      'allergies',
      'chronicDiseases',
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: withoutPassword(user),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
