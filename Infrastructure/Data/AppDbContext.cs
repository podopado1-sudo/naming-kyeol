using Microsoft.EntityFrameworkCore;
using NameForm.Domain.Models;

namespace NameForm.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Recommendation> Recommendations => Set<Recommendation>();
    public DbSet<Candidate> Candidates => Set<Candidate>();
    public DbSet<UserFeedback> UserFeedbacks => Set<UserFeedback>();
    public DbSet<UsageEvent> UsageEvents => Set<UsageEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Recommendation
        modelBuilder.Entity<Recommendation>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.LastName).IsRequired().HasMaxLength(10);
            entity.Property(e => e.Gender).IsRequired().HasMaxLength(10);
            entity.Property(e => e.Tone).IsRequired().HasMaxLength(20);

            entity.HasMany(e => e.TopCandidates)
                  .WithOne()
                  .HasForeignKey("RecommendationId")
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // Candidate
        modelBuilder.Entity<Candidate>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.Property(e => e.Name).IsRequired().HasMaxLength(20);
            entity.Property(e => e.NamingModel).HasMaxLength(50);
            entity.Property(e => e.NameType).HasMaxLength(20);

            // Reasons를 JSON으로 저장
            entity.Property(e => e.Reasons)
                  .HasConversion(
                      v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                      v => System.Text.Json.JsonSerializer.Deserialize<List<string>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new List<string>());
        });

        // UserFeedback
        modelBuilder.Entity<UserFeedback>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.RecommendationId).IsRequired();
            entity.Property(e => e.Name).IsRequired().HasMaxLength(20);
            entity.Property(e => e.LastName).IsRequired().HasMaxLength(10);
            entity.Property(e => e.FeedbackType).IsRequired().HasMaxLength(20);
            entity.Property(e => e.Reason).HasMaxLength(500);

            entity.HasIndex(e => e.RecommendationId);
        });

        // UsageEvent
        modelBuilder.Entity<UsageEvent>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.EventType).IsRequired().HasMaxLength(30);
            entity.Property(e => e.Key).IsRequired().HasMaxLength(40);
            entity.HasIndex(e => e.CreatedAt);
        });
    }
}
