import { sendEmailVerification } from 'firebase/auth';

class EmailService {
  static async sendConfirmationEmail(user) {
    try {
      if (!user) {
        throw new Error('User object is required to send verification email');
      }

      // Check if we're using emulators
      const isEmulator = import.meta.env.VITE_FIREBASE_EMULATOR_ENABLED === 'true';

      // In development/emulator mode, skip the actual verification
      if (isEmulator) {
        console.warn('Using emulator - skipping email verification');
        return { success: true, message: 'Email verification skipped in emulator mode' };
      }

      // Configure action code settings
      const actionCodeSettings = {
        url: `${window.location.origin}/signin`,
        handleCodeInApp: true,
      };

      // Send verification email directly to the newly created user
      await sendEmailVerification(user, actionCodeSettings);

      return {
        success: true,
        message: 'Verification email sent successfully',
      };

    } catch (error) {
      console.error('Error sending confirmation email:', error);
      throw new Error('Failed to send confirmation email');
    }
  }
}

export default EmailService;
