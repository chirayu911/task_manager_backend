const Project = require('../models/Project');
const User = require('../models/User');
const sendAssignEmail = require('../utils/sendAssignEmail');

const getProjects = async (req, res) => {
  try {
    const projects = await Project.find()
      .populate('assignedUsers', 'name email role')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 }); 
      
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: 'Server Error while fetching projects' });
  }
};

const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('assignedUsers', 'name email role')
      .populate('createdBy', 'name');

    if (!project) return res.status(404).json({ message: 'Project not found' });
    
    res.json(project);
  } catch (error) {
    res.status(500).json({ message: 'Invalid Project ID format' });
  }
};

const createProject = async (req, res) => {
  try {
    const { title, description, assignedUsers } = req.body;

    let finalAssignedUsers = [];
    if (Array.isArray(assignedUsers)) {
      finalAssignedUsers = assignedUsers;
    } else if (typeof assignedUsers === 'string' && assignedUsers !== "") {
      try {
        finalAssignedUsers = JSON.parse(assignedUsers);
      } catch (e) {
        finalAssignedUsers = [assignedUsers];
      }
    }

    const project = await Project.create({
      title,
      description,
      assignedUsers: finalAssignedUsers,
      createdBy: req.user._id 
    });

    if (finalAssignedUsers.length > 0) {
      const staffMembers = await User.find({ _id: { $in: finalAssignedUsers } });
      
      for (const staff of staffMembers) {
        if (staff.email) {
          await sendAssignEmail(
            staff.email, 
            staff.name, 
            `Project Assigned: ${title}`, 
            description, 
            [], 
            'assignment'
          );
        }
      }
    }

    const populatedProject = await project.populate('assignedUsers', 'name email');
    res.status(201).json(populatedProject);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateProject = async (req, res) => {
  try {
    const { title, description, assignedUsers } = req.body;
    const oldProject = await Project.findById(req.params.id);

    if (!oldProject) return res.status(404).json({ message: 'Project not found' });

    let finalAssignedUsers = [];
    if (Array.isArray(assignedUsers)) {
      finalAssignedUsers = assignedUsers;
    } else if (typeof assignedUsers === 'string' && assignedUsers !== "") {
      try {
        finalAssignedUsers = JSON.parse(assignedUsers);
      } catch (e) {
        finalAssignedUsers = [assignedUsers];
      }
    }

    const updatedProject = await Project.findByIdAndUpdate(
      req.params.id,
      { title, description, assignedUsers: finalAssignedUsers },
      { new: true } 
    ).populate('assignedUsers', 'name email');

    const oldUserIds = oldProject.assignedUsers.map(id => id.toString());
    const newUserIds = finalAssignedUsers.filter(id => !oldUserIds.includes(id.toString()));

    if (newUserIds.length > 0) {
      const newStaff = await User.find({ _id: { $in: newUserIds } });
      for (const staff of newStaff) {
        if (staff.email) {
          await sendAssignEmail(
            staff.email, 
            staff.name, 
            `Added to Project: ${title || updatedProject.title}`, 
            description, 
            [], 
            'assignment'
          );
        }
      }
    }

    res.json(updatedProject);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

const deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    
    await project.deleteOne();
    res.json({ message: 'Project removed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error while deleting project' });
  }
};

// ⭐ Make sure this export block exists so the Router can see these functions
module.exports = { 
  getProjects, 
  getProjectById, 
  createProject, 
  updateProject, 
  deleteProject 
};