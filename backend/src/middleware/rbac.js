export function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required." });
    }

    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission for this action." });
    }

    return next();
  };
}

