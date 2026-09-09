const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

code = code.replace(/newlyGeneratedCredentials/g, 'createdUser');
code = code.replace(/onClick=\{handleContinueToApp\}/g, 'onClick={() => createdUser && onAuthSuccess(createdUser)}');
code = code.replace(/handleRegister\b/g, 'handleRegisterSubmit');
code = code.replace(/handleLogin\b/g, 'handleLoginSubmit');
code = code.replace(/onChange=\{handleFileSelect\}/g, 'onChange={handleFileChange}');
code = code.replace(/avatarPreview/g, 'activeAvatar');

code = code.replace(/value=\{regData.fullName\}/g, 'value={fullName}');
code = code.replace(/setRegData\(\{\.\.\.regData, fullName: e.target.value\}\)/g, 'setFullName(e.target.value)');

code = code.replace(/value=\{regData.mobile\}/g, 'value={mobileNumber}');
code = code.replace("setRegData({...regData, mobile: e.target.value.replace(/\\D/g, '')})", "setMobileNumber(e.target.value.replace(/\\D/g, ''))");

code = code.replace(/value=\{regData.villageCity\}/g, 'value={villageCity}');
code = code.replace(/setRegData\(\{\.\.\.regData, villageCity: e.target.value\}\)/g, 'setVillageCity(e.target.value)');

code = code.replace(/value=\{regData.gender\}/g, 'value={gender}');
code = code.replace(/setRegData\(\{\.\.\.regData, gender: e.target.value as 'Male' \| 'Female' \| 'Other'\}\)/g, "setGender(e.target.value as 'male' | 'female')");
code = code.replace(/<option value="Male">Male<\/option>/, '<option value="male">Male</option>');
code = code.replace(/<option value="Female">Female<\/option>/, '<option value="female">Female</option>');

code = code.replace(/value=\{loginData.username\}/g, 'value={loginUsername}');
code = code.replace(/setLoginData\(\{\.\.\.loginData, username: e.target.value.toLowerCase\(\)\}\)/g, 'setLoginUsername(e.target.value.toLowerCase())');

code = code.replace(/value=\{loginData.password\}/g, 'value={loginPassword}');
code = code.replace(/setLoginData\(\{\.\.\.loginData, password: e.target.value\}\)/g, 'setLoginPassword(e.target.value)');

code = code.replace(/showPassword/g, 'showLoginPassword');
code = code.replace(/setShowLoginPassword\(!showLoginPassword\)/g, 'setShowLoginPassword(!showLoginPassword)');


fs.writeFileSync('src/components/AuthScreen.tsx', code);
