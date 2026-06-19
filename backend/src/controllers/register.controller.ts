import { Response, NextFunction } from 'express';
import { registrationService } from '../services/registration.service';
import { AuthRequest } from '../middleware/auth';

export async function register(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const {
      fullName,
      email,
      phoneCountryIso,
      phoneNumber,
      linkedinUrl,
      appliedRole,
      referralCode,
      password,
      visitorId,
      experienceCategory,
    } = req.body;
    const resume = req.file;

    if (!resume) {
      return res.status(400).json({ success: false, message: 'Resume PDF is required' });
    }

    const result = await registrationService.register(
      {
        fullName,
        email,
        phoneCountryIso: phoneCountryIso || 'IN',
        phoneNumber,
        linkedinUrl,
        appliedRole,
        referralCode,
        password,
        visitorId,
        experienceCategory,
      },
      resume
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful. Check your email for your assessment link.',
      candidateId: result.candidateId,
      candidateName: result.candidateName,
      email: result.email,
    });
  } catch (error) {
    next(error);
  }
}
