local x = nil
local x_ = (x and x.k or "fallback")
assert(x_ == "fallback")
local y = "ok"
local y_ = (y or error("should not raise"))
assert(y == y_)