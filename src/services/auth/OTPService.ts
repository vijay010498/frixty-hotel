import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

export class OTPService {
  static async toHash(OTP: number) {
    const salt = randomBytes(8).toString("hex");
    const buf = (await scryptAsync(OTP.toString(), salt, 64)) as Buffer;

    return `${buf.toString("hex")}.${salt}`;
  }

  static async compare(storedOTP: string, suppliedOTP: number) {
    const [hashedOTP, salt] = storedOTP.split(".");
    const buf = (await scryptAsync(suppliedOTP.toString(), salt, 64)) as Buffer;
    return buf.toString("hex") === hashedOTP;
  }
}
