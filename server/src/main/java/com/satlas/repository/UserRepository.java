package com.satlas.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.satlas.entity.User;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByDiscordId(String discordId);
}
