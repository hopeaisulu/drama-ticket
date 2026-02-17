-- 1. Remove the restriction on seat types so users can create new ones
ALTER TABLE public.seats DROP CONSTRAINT IF EXISTS seats_type_check;

-- 2. Add 'seat_tiers' to events to store definitions (Name, Price, Color)
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS seat_tiers JSONB DEFAULT '[
    {"name": "vip", "price": 1000, "color": "#FFD700"},
    {"name": "standard", "price": 500, "color": "#4169E1"},
    {"name": "budget", "price": 300, "color": "#00FA9A"}
]'::jsonb;

-- 3. Update existing event to have these defaults if null
UPDATE public.events 
SET seat_tiers = '[
    {"name": "vip", "price": 1000, "color": "#FFD700"},
    {"name": "standard", "price": 500, "color": "#4169E1"},
    {"name": "budget", "price": 300, "color": "#00FA9A"}
]'::jsonb
WHERE seat_tiers IS NULL;
