export async function isBiometricsSupported() {
  if (window.PublicKeyCredential) {
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch (e) {
      return false;
    }
  }
  return false;
}

export async function registerBiometrics() {
  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);

    const publicKey: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: { name: "RepairShop Pro", id: window.location.hostname },
      user: {
        id: userId,
        name: "admin",
        displayName: "Admin User"
      },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      authenticatorSelection: { 
        authenticatorAttachment: "platform",
        userVerification: "required"
      },
      timeout: 60000,
    };

    const credential = await navigator.credentials.create({ publicKey });
    if (credential) {
      localStorage.setItem('biometric_enabled', 'true');
      return true;
    }
    return false;
  } catch (error: any) {
    if (error.message && error.message.includes('publickey-credentials-create')) {
      throw new Error('IFRAME_POLICY');
    }
    console.warn("Biometric registration failed:", error);
    return false;
  }
}

export async function authenticateBiometrics() {
  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const publicKey: PublicKeyCredentialRequestOptions = {
      challenge,
      timeout: 60000,
      userVerification: "required",
    };

    const credential = await navigator.credentials.get({ publicKey });
    return !!credential;
  } catch (error: any) {
    if (error.message && error.message.includes('publickey-credentials-get')) {
      throw new Error('IFRAME_POLICY');
    }
    console.warn("Biometric authentication failed:", error);
    return false;
  }
}

export async function pickContact() {
  if ('contacts' in navigator && 'ContactsManager' in window) {
    try {
      const props = ['name', 'tel'];
      const opts = { multiple: false };
      // @ts-ignore
      const contacts = await navigator.contacts.select(props, opts);
      if (contacts && contacts.length > 0) {
        return {
          name: contacts[0].name?.[0] || '',
          phone: contacts[0].tel?.[0] || ''
        };
      }
    } catch (ex: any) {
      console.warn("Contact picking failed:", ex);
      throw new Error("لم يتم منح صلاحية الوصول لجهات الاتصال");
    }
  } else {
    throw new Error("متصفحك لا يدعم قراءة جهات الاتصال بشكل مباشر");
  }
  return null;
}

