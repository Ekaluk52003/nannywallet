import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { googleLogout, useGoogleLogin, TokenResponse } from '@react-oauth/google';

interface User {
  name: string;
  email: string;
  picture: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  login: () => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Default to true to block premature rendering

  const login = useGoogleLogin({
    onSuccess: (tokenResponse: TokenResponse) => {
      const expiresIn = tokenResponse.expires_in || 3599;
      const expiryDate = Date.now() + expiresIn * 1000;

      setAccessToken(tokenResponse.access_token);
      localStorage.setItem('google_access_token', tokenResponse.access_token);
      localStorage.setItem('token_expiry', expiryDate.toString());

      fetchUserProfile(tokenResponse.access_token);
    },
    onError: (error) => console.log('Login Failed:', error),
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file openid email profile',
  });

  const logout = () => {
    console.log("Logging out...");
    googleLogout();
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('token_expiry');
    localStorage.removeItem('user_profile');
    localStorage.removeItem('nanny_spreadsheet_id');
    localStorage.removeItem('last_wallet_id');
  };

  const fetchUserProfile = async (token: string) => {
    // Don't set global isLoading to true here if we want background refresh,
    // but for initial load it's fine.
    try {
      const res = await fetch(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${token}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch user profile: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      console.log("User profile fetched:", data);
      const userData = {
        name: data.name,
        email: data.email,
        picture: data.picture,
      };
      setUser(userData);
      localStorage.setItem('user_profile', JSON.stringify(userData));
    } catch (err) {
      console.error("Failed to fetch user profile", err);
      // If fetching profile fails (e.g. expired token), log out
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  // Restore user session on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('google_access_token');
    const storedExpiry = localStorage.getItem('token_expiry');
    const storedUser = localStorage.getItem('user_profile');

    const checkSession = async () => {
      if (storedToken) {
        // 1. Check Expiry if available
        if (storedExpiry) {
          const expiryTime = parseInt(storedExpiry, 10);
          if (Date.now() > expiryTime) {
            console.log("Token expired, logging out.");
            logout();
            setIsLoading(false);
            return;
          }
        }

        // 2. Token seems valid (or unknown expiry), set it
        setAccessToken(storedToken);

        // 3. Restore User or Fetch
        if (storedUser) {
          setUser(JSON.parse(storedUser));
          // Optional: Validate token in background if we relied on localStorage expiry
          // If we didn't have expiry (legacy), we MUST validate.
          if (!storedExpiry) {
            await fetchUserProfile(storedToken);
          } else {
            setIsLoading(false);
          }
        } else {
          await fetchUserProfile(storedToken);
        }
      } else {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  return (
    <AuthContext.Provider value={{ user, accessToken, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
