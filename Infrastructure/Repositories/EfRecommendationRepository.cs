using Microsoft.EntityFrameworkCore;
using NameForm.Domain.Models;
using NameForm.Infrastructure.Data;

namespace NameForm.Infrastructure.Repositories;

public class EfRecommendationRepository : IRecommendationRepository
{
    private readonly AppDbContext _context;

    public EfRecommendationRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task SaveAsync(Recommendation recommendation)
    {
        var existing = await _context.Recommendations.FindAsync(recommendation.Id);
        if (existing != null)
        {
            _context.Entry(existing).CurrentValues.SetValues(recommendation);
        }
        else
        {
            _context.Recommendations.Add(recommendation);
        }

        await _context.SaveChangesAsync();
    }

    public async Task<Recommendation?> GetByIdAsync(string id)
    {
        return await _context.Recommendations
            .Include(r => r.TopCandidates)
            .FirstOrDefaultAsync(r => r.Id == id);
    }

    public async Task SaveFeedbackAsync(UserFeedback feedback)
    {
        _context.UserFeedbacks.Add(feedback);
        await _context.SaveChangesAsync();
    }

    public async Task<List<UserFeedback>> GetFeedbackByRecommendationIdAsync(string recommendationId)
    {
        return await _context.UserFeedbacks
            .Where(f => f.RecommendationId == recommendationId)
            .OrderByDescending(f => f.CreatedAt)
            .ToListAsync();
    }
}
