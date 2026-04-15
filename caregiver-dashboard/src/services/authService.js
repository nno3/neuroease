import { api } from "./apiClient";

export function getProfile() {
    return api.get("/auth/profile");
}

/**
 * Update profile. All fields optional.
 * @param {{ name?: string, email?: string, avatar?: string | null, currentPassword?: string, newPassword?: string }} payload
 */
export function updateProfile(payload) {
    return api.put("/auth/profile", payload);
}

/** Delete the current user's account. Requires authentication. */
export function deleteAccount() {
    return api.delete("/auth/profile");
}
