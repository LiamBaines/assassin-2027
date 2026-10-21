package com.assassin.api.player;

import com.assassin.api.common.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ProfileController {

    private final ProfileService profileService;

    public ProfileController(ProfileService profileService) {
        this.profileService = profileService;
    }

    /** First-login name. 409 {@code PROFILE_EXISTS} once set: there is no way to change it. */
    @PutMapping("/api/me/profile")
    @ResponseStatus(HttpStatus.CREATED)
    public ProfileView create(CurrentUser user, @Valid @RequestBody ProfileRequest request) {
        return ProfileView.from(profileService.create(user, request.displayName()));
    }

    public record ProfileRequest(@NotBlank @Size(max = 64) String displayName) {

        public ProfileRequest {
            displayName = displayName == null ? null : displayName.strip();
        }
    }
}
