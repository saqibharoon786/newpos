const logger = require('../loaders/logger');

// In-memory cache fallback
const memoryCache = new Map();

// Cache middleware
const cacheMiddleware = (duration = 60) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = `cache:${req.originalUrl || req.url}`;
    let cachedData = null;

    // Try Redis first, then memory cache
    if (req.app.get('redisClient')) {
      try {
        const cached = await req.app.get('redisClient').get(key);
        if (cached) {
          cachedData = JSON.parse(cached);
        }
      } catch (error) {
        logger.error('Redis cache error:', error);
      }
    }

    // Fallback to memory cache
    if (!cachedData && memoryCache.has(key)) {
      const cachedItem = memoryCache.get(key);
      if (Date.now() < cachedItem.expiry) {
        cachedData = cachedItem.data;
      } else {
        memoryCache.delete(key);
      }
    }

    // Return cached data if found
    if (cachedData) {
      logger.debug(`Cache hit for: ${req.url}`);
      return res.json({
        ...cachedData,
        cached: true,
        cachedAt: new Date().toISOString()
      });
    }

    // Store original json method
    const originalJson = res.json;
    
    // Override json method to cache response
    res.json = function(data) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const cacheData = {
          ...data,
          cached: false,
          cachedAt: new Date().toISOString()
        };

        // Store in Redis if available
        if (req.app.get('redisClient')) {
          req.app.get('redisClient').setex(
            key,
            duration,
            JSON.stringify(cacheData)
          ).catch(err => {
            logger.error('Error caching to Redis:', err);
          });
        }

        // Store in memory cache as fallback
        memoryCache.set(key, {
          data: cacheData,
          expiry: Date.now() + (duration * 1000)
        });

        // Clean up expired memory cache entries periodically
        if (memoryCache.size > 1000) {
          for (const [cacheKey, item] of memoryCache.entries()) {
            if (Date.now() > item.expiry) {
              memoryCache.delete(cacheKey);
            }
          }
        }
      }

      // Call original json method
      return originalJson.call(this, data);
    };

    next();
  };
};

// Clear cache function
const clearCache = async (key) => {
  try {
    // Clear from memory cache
    memoryCache.delete(key);
    
    // Clear from Redis if available
    if (global.redisClient) {
      await global.redisClient.del(key);
    }
    
    return true;
  } catch (error) {
    logger.error('Error clearing cache:', error);
    return false;
  }
};

// Clear cache by pattern
const clearCachePattern = async (pattern) => {
  try {
    // Clear from memory cache
    for (const [key] of memoryCache.entries()) {
      if (key.includes(pattern)) {
        memoryCache.delete(key);
      }
    }
    
    // Clear from Redis if available
    if (global.redisClient) {
      const keys = await global.redisClient.keys(`*${pattern}*`);
      if (keys.length > 0) {
        await global.redisClient.del(keys);
      }
    }
    
    return true;
  } catch (error) {
    logger.error('Error clearing cache pattern:', error);
    return false;
  }
};

module.exports = {
  cacheMiddleware,
  clearCache,
  clearCachePattern,
  memoryCache
};