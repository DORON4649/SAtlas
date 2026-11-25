package com.satlas.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.satlas.entity.Memo;

public interface MemoRepository extends JpaRepository<Memo, Long> {

    @Query("select m from Memo m where m.userId = :userId order by m.updatedAt desc")
    List<Memo> findOwn(@Param("userId") Long userId);

    @Query("select m from Memo m where m.userId = :userId or m.isShared = true order by m.updatedAt desc")
    List<Memo> findOwnAndShared(@Param("userId") Long userId);
}
