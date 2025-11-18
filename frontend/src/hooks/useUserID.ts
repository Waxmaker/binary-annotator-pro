import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";

const USER_ID_KEY = "binary_annotator_user_id";

/**
 * Hook to manage persistent user ID in localStorage
 * Generates a UUID on first use and persists it
 */
export function useUserID(): string {
  const [userID, setUserID] = useState<string>(() => {
    // Try to get existing user ID from localStorage
    const existing = localStorage.getItem(USER_ID_KEY);
    if (existing) {
      return existing;
    }

    // Generate new UUID
    const newID = uuidv4();
    localStorage.setItem(USER_ID_KEY, newID);
    return newID;
  });

  useEffect(() => {
    // Ensure user ID is always in localStorage
    const stored = localStorage.getItem(USER_ID_KEY);
    if (!stored) {
      localStorage.setItem(USER_ID_KEY, userID);
    }
  }, [userID]);

  return userID;
}

/**
 * Get user ID synchronously (for use outside React components)
 */
export function getUserID(): string {
  const existing = localStorage.getItem(USER_ID_KEY);
  if (existing) {
    return existing;
  }

  const newID = uuidv4();
  localStorage.setItem(USER_ID_KEY, newID);
  return newID;
}
