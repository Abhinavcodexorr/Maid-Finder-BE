// Dev-mode stub: every OTP is "123456", nothing is actually sent anywhere.
// This is the one function to replace with a real SMS provider later —
// everything that calls it (sendOtp/verifyOtp in providerController) stays
// the same either way.
//
// generateOtp() returns the code to store/verify against.
// deliverOtp(mobileNumber, otp) is where a real provider's send-SMS call
// would go; for now it just logs, so the code/team can read it off the
// server console during testing.
const generateOtp = () => '123456';

const deliverOtp = async (mobileNumber, otp) => {
  console.log(`[otp] ${mobileNumber} -> ${otp} (dev-mode stub, not actually sent)`);
};

module.exports = { generateOtp, deliverOtp };
