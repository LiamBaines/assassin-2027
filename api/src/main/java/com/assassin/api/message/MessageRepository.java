package com.assassin.api.message;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface MessageRepository extends JpaRepository<Message, Long> {

    List<Message> findByAssignmentIdAndDeletedAtIsNullOrderById(long assignmentId);

    List<Message> findByGameIdAndKindAndDeletedAtIsNullOrderById(String gameId, MessageKind kind);

    List<Message> findByRecipientIdAndKindAndDeletedAtIsNullOrderById(UUID recipientId, MessageKind kind);

    /** Messages the sender sent in the assignment since {@code since}, deleted ones included, for the rate limit. */
    long countByAssignmentIdAndSenderIdAndCreatedAtAfter(long assignmentId, UUID senderId, Instant since);

    /** Unread, undeleted messages in the given assignments that were not sent by {@code readerId}. */
    @Query("""
            select count(m) from Message m
             where m.assignmentId in :assignmentIds and m.senderId <> :readerId
               and m.readAt is null and m.deletedAt is null
            """)
    long countUnread(Collection<Long> assignmentIds, UUID readerId);

    @Modifying(flushAutomatically = true)
    @Query("""
            update Message m set m.readAt = :at
             where m.assignmentId = :assignmentId and m.senderId <> :readerId and m.readAt is null
            """)
    int markRead(long assignmentId, UUID readerId, Instant at);

    @Query("""
            select count(m) from Message m
             where m.kind = com.assassin.api.message.MessageKind.ADMIN and m.recipientId = :playerId
               and m.readAt is null and m.deletedAt is null
            """)
    long countAdminUnread(UUID playerId);

    @Modifying(flushAutomatically = true)
    @Query("""
            update Message m set m.readAt = :at
             where m.kind = com.assassin.api.message.MessageKind.ADMIN and m.recipientId = :playerId
               and m.readAt is null
            """)
    int markAdminRead(UUID playerId, Instant at);
}
