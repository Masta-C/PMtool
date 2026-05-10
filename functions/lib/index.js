"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthCheck = exports.deleteWorkstation = exports.deleteUser = exports.createUser = exports.setUserRole = void 0;
const https_1 = require("firebase-functions/v2/https");
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
const ADMIN_ROLES = ['super_admin', 'admin', 'supervisor'];
const VALID_ROLES = ['super_admin', 'admin', 'supervisor', 'operator', 'qa'];
exports.setUserRole = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Must be logged in');
    const callerRole = request.auth.token.role;
    const { targetUid, role } = request.data;
    if (!ADMIN_ROLES.includes(callerRole))
        throw new https_1.HttpsError('permission-denied', 'Insufficient role');
    if (role === 'super_admin' && callerRole !== 'super_admin')
        throw new https_1.HttpsError('permission-denied', 'Only super_admin can assign super_admin role');
    if (!VALID_ROLES.includes(role))
        throw new https_1.HttpsError('invalid-argument', 'Invalid role');
    await (0, auth_1.getAuth)().setCustomUserClaims(targetUid, { role });
    await (0, firestore_1.getFirestore)().collection('users').doc(targetUid).update({ role });
    return { success: true };
});
exports.createUser = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Must be logged in');
    const callerRole = request.auth.token.role;
    if (!ADMIN_ROLES.includes(callerRole))
        throw new https_1.HttpsError('permission-denied', 'Insufficient role');
    const { email, password, displayName, role, workstationIds = [] } = request.data;
    if (role === 'super_admin' && callerRole !== 'super_admin')
        throw new https_1.HttpsError('permission-denied', 'Only super_admin can create super_admin users');
    if (!VALID_ROLES.includes(role))
        throw new https_1.HttpsError('invalid-argument', 'Invalid role');
    const userRecord = await (0, auth_1.getAuth)().createUser({ email, password, displayName });
    await (0, auth_1.getAuth)().setCustomUserClaims(userRecord.uid, { role });
    await (0, firestore_1.getFirestore)().collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid, email, displayName, role, workstationIds,
        shiftId: null, isActive: true,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        createdBy: request.auth.uid,
    });
    return { uid: userRecord.uid };
});
exports.deleteUser = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Must be logged in');
    if (request.auth.token.role !== 'super_admin')
        throw new https_1.HttpsError('permission-denied', 'Only super_admin can delete users');
    const { targetUid } = request.data;
    if (targetUid === request.auth.uid)
        throw new https_1.HttpsError('invalid-argument', 'Cannot delete your own account');
    await (0, auth_1.getAuth)().deleteUser(targetUid);
    await (0, firestore_1.getFirestore)().collection('users').doc(targetUid).delete();
    return { success: true };
});
exports.deleteWorkstation = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Must be logged in');
    if (request.auth.token.role !== 'super_admin')
        throw new https_1.HttpsError('permission-denied', 'Only super_admin can delete workstations');
    const { wsId } = request.data;
    const snap = await (0, firestore_1.getFirestore)().collection('workstations').count().get();
    if (snap.data().count <= 1)
        throw new https_1.HttpsError('failed-precondition', 'Cannot delete the last workstation');
    await (0, firestore_1.getFirestore)().collection('workstations').doc(wsId).delete();
    return { success: true };
});
exports.healthCheck = (0, https_1.onCall)({ region: 'asia-south1' }, async () => {
    return { status: 'ok', project: 'pmtool-3f8db', phase: 1 };
});
//# sourceMappingURL=index.js.map