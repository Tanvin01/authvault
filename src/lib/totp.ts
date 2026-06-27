import { authenticator } from "otplib";
import QRCode from "qrcode";
export const generateTotpSecret = () => authenticator.generateSecret();
export const generateQRCode = (email: string, secret: string) =>
  QRCode.toDataURL(authenticator.keyuri(email, "AuthVault", secret));
export const verifyTotp = (secret: string, token: string) =>
  authenticator.verify({ token, secret });
