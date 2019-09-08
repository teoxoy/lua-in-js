
-- Implicit in the fact that it's already using assertTrue()
assertTrue (mainGlobal2 == 'mainGlbl', 'Modules should have access to the same global namespace')
assertTrue (mainLocal == nil, 'Modules should not have access to the local scope of the caller')

local testModName = ...
assertTrue (testModName == 'lib-require', 'A module\'s name should be passed into the module using varargs.')


local sub = require 'lib-require.sub-module'	-- test dot syntax
assertTrue(type(sub) == 'table', 'Module should be able to load more modules using dot syntax.')

local sub2 = require 'lib-require/sub-module'  -- test slash syntax
assertTrue(type(sub2) == 'table', 'Module should be able to load more modules using slash syntax.')

mainGlobal1 = 'innerGlbl'
local innerLocal = 'innerLoc'

moduleInitCount = moduleInitCount + 1


return {
	getValue = function ()
		return 'modVal'
	end
}
