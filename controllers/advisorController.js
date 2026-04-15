import AdvisorOnboarding from "../models/AdvisorOnboarding.js";

// Submit Advisor Onboarding Form
export const submitAdvisorOnboarding = async (req, res) => {
  try {
    const {
      uid,
      email,
      fullName,
      fatherName,
      dateOfBirth,
      gender,
      nationality,
      enrollmentNumber,
      dateOfEnrollment,
      stateBarCouncil,
      barAssociationName,
      yearsOfPractice,
      areaOfPractice,
      chamberAddress,
      contactNumber,
      emailId,
      aadhaarNumber,
      panNumber,
      otherIdNumber,
      barCertificate,
      identityProof,
      photograph,
      chamberProof,
      declarationAgreed,
      declarationDate,
      declarationPlace,
      authorityName,
      designation,
      authorityDate,
    } = req.body;

    // Validate required fields
    if (!uid || !email || !fullName || !enrollmentNumber || !stateBarCouncil) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if advisor already exists
    const existingAdvisor = await AdvisorOnboarding.findOne({ uid });
    if (existingAdvisor) {
      return res
        .status(409)
        .json({ error: "Advisor application already submitted" });
    }

    // Create new advisor onboarding record
    const newAdvisor = new AdvisorOnboarding({
      uid,
      email,
      fullName,
      fatherName,
      dateOfBirth,
      gender,
      nationality,
      enrollmentNumber,
      dateOfEnrollment,
      stateBarCouncil,
      barAssociationName,
      yearsOfPractice,
      areaOfPractice,
      chamberAddress,
      contactNumber,
      emailId,
      aadhaarNumber,
      panNumber,
      otherIdNumber,
      barCertificate,
      identityProof,
      photograph,
      chamberProof,
      declarationAgreed,
      declarationDate,
      declarationPlace,
      authorityName,
      designation,
      authorityDate,
      verificationStatus: "pending",
      appliedAt: new Date(), // Explicit timestamp
      updatedAt: new Date(),
    });

    console.log(`📝 Creating advisor: ${fullName} with status: pending`);
    await newAdvisor.save();
    console.log(`✓ Advisor saved successfully with ID: ${newAdvisor._id}`);

    res.status(201).json({
      message: "Advisor application submitted successfully",
      advisor: newAdvisor,
    });
  } catch (error) {
    console.error("Error submitting advisor onboarding:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get All Pending Advisor Applications (Admin)
export const getPendingAdvisors = async (req, res) => {
  try {
    const advisors = await AdvisorOnboarding.find({ verificationStatus: "pending" }).sort({ appliedAt: -1 });

    res.status(200).json({
      count: advisors.length,
      advisors,
    });
  } catch (error) {
    console.error("Error fetching pending advisors:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get Advisor Application by UID
export const getAdvisorApplication = async (req, res) => {
  try {
    const { uid } = req.params;

    const advisor = await AdvisorOnboarding.findOne({ uid });

    if (!advisor) {
      return res.status(404).json({ error: "Advisor application not found" });
    }

    res.status(200).json(advisor);
  } catch (error) {
    console.error("Error fetching advisor application:", error);
    res.status(500).json({ error: error.message });
  }
};

// Approve Advisor Application (Admin)
export const approveAdvisor = async (req, res) => {
  try {
    const { uid } = req.params;
    const { adminId, adminName } = req.body;

    if (!adminId || !adminName) {
      return res.status(400).json({ error: "Admin info required" });
    }

    const advisor = await AdvisorOnboarding.findOneAndUpdate(
      { uid },
      {
        verificationStatus: "verified",
        isVerified: true,
        reviewedBy: adminId,
        reviewerName: adminName,
        reviewedAt: new Date(),
      },
      { new: true }
    );

    if (!advisor) {
      return res.status(404).json({ error: "Advisor not found" });
    }

    res.status(200).json({
      message: "Advisor approved successfully",
      advisor,
    });
  } catch (error) {
    console.error("Error approving advisor:", error);
    res.status(500).json({ error: error.message });
  }
};

// Reject Advisor Application (Admin)
export const rejectAdvisor = async (req, res) => {
  try {
    const { uid } = req.params;
    const { adminId, adminName, rejectionReason } = req.body;

    if (!adminId || !adminName || !rejectionReason) {
      return res
        .status(400)
        .json({ error: "Admin info and rejection reason required" });
    }

    const advisor = await AdvisorOnboarding.findOneAndUpdate(
      { uid },
      {
        verificationStatus: "rejected",
        isVerified: false,
        rejectionReason,
        reviewedBy: adminId,
        reviewerName: adminName,
        reviewedAt: new Date(),
      },
      { new: true }
    );

    if (!advisor) {
      return res.status(404).json({ error: "Advisor not found" });
    }

    res.status(200).json({
      message: "Advisor application rejected",
      advisor,
    });
  } catch (error) {
    console.error("Error rejecting advisor:", error);
    res.status(500).json({ error: error.message });
  }
};

// Update Advisor Status to Under Review (Admin)
export const reviewAdvisor = async (req, res) => {
  try {
    const { uid } = req.params;
    const { adminId, adminName } = req.body;

    if (!adminId || !adminName) {
      return res.status(400).json({ error: "Admin info required" });
    }

    const advisor = await AdvisorOnboarding.findOneAndUpdate(
      { uid },
      {
        verificationStatus: "under_review",
        reviewedBy: adminId,
        reviewerName: adminName,
      },
      { new: true }
    );

    if (!advisor) {
      return res.status(404).json({ error: "Advisor not found" });
    }

    res.status(200).json({
      message: "Advisor moved to under_review status",
      advisor,
    });
  } catch (error) {
    console.error("Error reviewing advisor:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get All Verified Advisors (Public - for Advisors Tab)
export const getVerifiedAdvisors = async (req, res) => {
  try {
    const advisors = await AdvisorOnboarding.find({ isVerified: true, verificationStatus: "verified" }).sort({ appliedAt: -1 });

    res.status(200).json({
      count: advisors.length,
      advisors,
    });
  } catch (error) {
    console.error("Error fetching verified advisors:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get All Advisors (pending + verified) - for Marketplace Display
export const getAllAdvisors = async (req, res) => {
  try {
    // Debug: Check total documents
    const totalCount = await AdvisorOnboarding.countDocuments();
    console.log(`📊 Total documents in collection: ${totalCount}`);
    
    // Debug: Get all documents
    const allDocs = await AdvisorOnboarding.find({});
    console.log(`📋 All documents (raw): ${JSON.stringify(allDocs.map(d => ({ id: d._id, fullName: d.fullName, status: d.verificationStatus, isVerified: d.isVerified })), null, 2)}`);
    
    const advisors = await AdvisorOnboarding.find({
      $or: [
        { verificationStatus: "pending" },
        { verificationStatus: "verified", isVerified: true }
      ]
    }).sort({ appliedAt: -1 });
    
    console.log(`✓ Found ${advisors.length} advisors matching filter`);
    advisors.forEach(a => console.log(`  - ${a.fullName}: status=${a.verificationStatus}, isVerified=${a.isVerified}`));

    res.status(200).json({
      count: advisors.length,
      advisors,
    });
  } catch (error) {
    console.error("Error fetching all advisors:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get Advisor Statistics (Admin Dashboard)
export const getAdvisorStats = async (req, res) => {
  try {
    const stats = {
      total: await AdvisorOnboarding.countDocuments(),
      pending: await AdvisorOnboarding.countDocuments({ verificationStatus: "pending" }),
      underReview: await AdvisorOnboarding.countDocuments({ verificationStatus: "under_review" }),
      verified: await AdvisorOnboarding.countDocuments({ isVerified: true }),
      rejected: await AdvisorOnboarding.countDocuments({ verificationStatus: "rejected" }),
    };

    res.status(200).json(stats);
  } catch (error) {
    console.error("Error fetching advisor stats:", error);
    res.status(500).json({ error: error.message });
  }
};
