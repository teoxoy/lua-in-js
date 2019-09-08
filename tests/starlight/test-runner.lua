
local passed, failed = 0, 0
local startTime
local currentFile


if getTimestamp then
	startTime = getTimestamp()
end


function assertTrue (condition, message)
	if not condition then
		failed = failed + 1
		reportError(message)
	else
		passed = passed + 1
	end
end


function assertEqual (actual, expected, message)
	if actual ~= expected and (actual == actual or expected == expected) then
		failed = failed + 1
		reportError(message..'; expected "'..tostring(expected)..'", got "'..tostring(actual)..'".')
	else
		passed = passed + 1
	end
end


function run (modName)
	currentFile = modName
	dofile(modName..'.lua')
end


function reportError (message)
	if currentFile ~= lastErrorFile then
		print('\n-['..currentFile..']-----------------------------------------')
	end

	lastErrorFile = currentFile
	print('- '..message)
end


function showResults ()
	local durationStr = ''

	if getTimestamp then
		local endTime = getTimestamp()
		durationStr = '\nCompleted in '..(endTime - startTime)..'ms.'
	end

	print "\n------------------------"
	if failed == 0 then
		print " Passed."
	else
		print "FAILED!"
	end

	print "------------------------\n"
	print ("Total asserts: "..(passed + failed).."; Passed: "..passed.."; Failed: "..failed..durationStr)

	os.exit(failed)
end


run 'operators'
run 'functions'
run 'tables'
run 'control-structures'
run 'coercion'
run 'metamethods'
run 'lib'
run 'lib-string'
run 'lib-table'
run 'lib-math'
-- run 'lib-coroutine'
run 'lib-date'


showResults()
